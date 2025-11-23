import { useState, useEffect } from 'react'
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { Sdk } from '@aboutcircles/sdk'
import { circlesConfig } from '@aboutcircles/sdk-core'
import { useQuery } from '@tanstack/react-query'
import { createPublicClient, http, formatUnits, parseUnits } from 'viem'
import { gnosis } from 'wagmi/chains'
import { MODULE_ADDRESS, SAFE_ABI, USDC_ADDRESS, ERC20_ABI } from '../config/constants'

interface LenderInfo {
  address: string
  name?: string
  image?: string
  lendingCap: bigint
  minLendIR: number // APR %
  minLendIRRaw: bigint // Raw value from contract
  available: bigint // after 2% safety margin
  usdcBalance: bigint
  // Debug info
  lent: bigint
  owedPerSecond: bigint
  timestamp: bigint
  currentLent: bigint
  capRemaining: bigint
  rawAvailable: bigint
}

const MODULE_ABI = [{
  name: 'limits',
  type: 'function',
  stateMutability: 'view',
  inputs: [{ name: 'user', type: 'address' }],
  outputs: [
    { name: 'lendingCap', type: 'uint256' },
    { name: 'minLendIR', type: 'uint256' },
    { name: 'borrowCap', type: 'uint256' },
    { name: 'maxBorrowIR', type: 'uint256' },
    { name: 'minIRMargin', type: 'uint256' },
  ],
}, {
  name: 'balances',
  type: 'function',
  stateMutability: 'view',
  inputs: [{ name: 'user', type: 'address' }],
  outputs: [
    { name: 'lent', type: 'uint256' },
    { name: 'owedPerSecond', type: 'uint256' },
    { name: 'borrowed', type: 'uint256' },
    { name: 'owesPerSecond', type: 'uint256' },
    { name: 'timestamp', type: 'uint256' },
  ],
}, {
  name: 'borrow',
  type: 'function',
  stateMutability: 'nonpayable',
  inputs: [
    { name: 'amount', type: 'uint256' },
    { name: 'path', type: 'address[]' },
    { name: 'irs', type: 'uint256[]' },
  ],
  outputs: [],
}] as const

const publicClient = createPublicClient({
  chain: gnosis,
  transport: http(),
})

export function Borrow() {
  const { address } = useAccount()
  const [trustedByAddresses, setTrustedByAddresses] = useState<string[]>([])
  const [loadingTrust, setLoadingTrust] = useState(true)

  // Fetch trust relations
  useEffect(() => {
    if (!address) return

    const loadTrustRelations = async () => {
      try {
        setLoadingTrust(true)
        const sdk = new Sdk(circlesConfig[100])
        const relations = await sdk.data.getTrustRelations(address)

        // Filter for those who trust YOU (trustedBy or mutuallyTrusts)
        const trusters = relations
          .filter((rel: any) =>
            rel.relation === 'trustedBy' || rel.relation === 'mutuallyTrusts'
          )
          .map((rel: any) =>
            rel.subjectAvatar === address ? rel.objectAvatar : rel.subjectAvatar
          )

        console.log('People who trust you:', trusters)
        setTrustedByAddresses(trusters)
      } catch (err) {
        console.error('Failed to load trust relations:', err)
      } finally {
        setLoadingTrust(false)
      }
    }

    loadTrustRelations()
  }, [address])

  // Two-stage approach: first filter by module enabled, then fetch full data
  const { data: lenders, isLoading: loadingLenders } = useQuery({
    queryKey: ['lenders', trustedByAddresses],
    queryFn: async () => {
      if (trustedByAddresses.length === 0) return []

      const sdk = new Sdk(circlesConfig[100])

      // Stage 1: Check which addresses have module enabled
      const moduleCheckContracts = trustedByAddresses.map(addr => ({
        address: addr as `0x${string}`,
        abi: SAFE_ABI,
        functionName: 'isModuleEnabled',
        args: [MODULE_ADDRESS as `0x${string}`],
      }))

      console.log(`Stage 1: Checking module enabled for ${trustedByAddresses.length} addresses`)
      const moduleResults = await publicClient.multicall({ contracts: moduleCheckContracts })

      // Filter to only addresses with module enabled
      const enabledAddresses = trustedByAddresses.filter((_, i) =>
        moduleResults[i].status === 'success' && moduleResults[i].result === true
      )

      console.log(`Found ${enabledAddresses.length} addresses with module enabled`)
      if (enabledAddresses.length === 0) return []

      // Stage 2: Fetch full data for enabled addresses + metadata in parallel
      const dataContracts = enabledAddresses.flatMap(addr => [
        {
          address: MODULE_ADDRESS as `0x${string}`,
          abi: MODULE_ABI,
          functionName: 'limits',
          args: [addr as `0x${string}`],
        },
        {
          address: MODULE_ADDRESS as `0x${string}`,
          abi: MODULE_ABI,
          functionName: 'balances',
          args: [addr as `0x${string}`],
        },
        {
          address: USDC_ADDRESS as `0x${string}`,
          abi: ERC20_ABI,
          functionName: 'balanceOf',
          args: [addr as `0x${string}`],
        },
      ])

      console.log(`Stage 2: Fetching data for ${enabledAddresses.length} enabled addresses`)

      const [dataResults, block, profiles] = await Promise.all([
        publicClient.multicall({ contracts: dataContracts }),
        publicClient.getBlock(),
        Promise.all(enabledAddresses.map(async (addr) => {
          try {
            const avatarData = await sdk.data.getAvatar(addr as `0x${string}`)
            if (avatarData?.cidV0) {
              const profile = await sdk.profiles.get(avatarData.cidV0)
              return { addr, name: profile?.name, image: profile?.previewImageUrl }
            }
          } catch {
            // Profile fetch failed, continue without metadata
          }
          return { addr, name: undefined, image: undefined }
        }))
      ])

      const now = block.timestamp
      const profileMap = new Map(profiles.map(p => [p.addr, p]))

      // Parse results
      const lenderInfos: LenderInfo[] = []
      for (let i = 0; i < enabledAddresses.length; i++) {
        const addr = enabledAddresses[i]
        const limitsResult = dataResults[i * 3]
        const balancesResult = dataResults[i * 3 + 1]
        const usdcBalanceResult = dataResults[i * 3 + 2]

        if (
          limitsResult.status === 'success' &&
          balancesResult.status === 'success' &&
          usdcBalanceResult.status === 'success'
        ) {
          const limits = limitsResult.result as unknown as readonly [bigint, bigint, bigint, bigint, bigint]
          const balances = balancesResult.result as unknown as readonly [bigint, bigint, bigint, bigint, bigint]
          const usdcBalance = usdcBalanceResult.result as bigint

          const lendingCap = limits[0]  // 6 decimals
          const minLendIR = limits[1]
          const lent = balances[0]  // 6 decimals
          const owedPerSecond = balances[1]
          const timestamp = balances[4]

          // Skip if no lending cap configured
          if (lendingCap === 0n) continue

          // Calculate current lent with accrued interest
          const elapsed = now - timestamp
          const accruedInterest = owedPerSecond * elapsed
          const currentLent = lent + accruedInterest

          // Available = min(lendingCap - currentLent, usdcBalance)
          const capRemaining = lendingCap > currentLent ? lendingCap - currentLent : 0n
          const rawAvailable = capRemaining < usdcBalance ? capRemaining : usdcBalance

          // Apply 2% safety margin
          const available = (rawAvailable * 98n) / 100n

          // Skip if no available capacity
          if (available === 0n) continue

          const SECONDS_PER_YEAR = 365 * 24 * 60 * 60
          const minLendIRPercent = Number(minLendIR) / 1e18 * SECONDS_PER_YEAR * 100

          const profile = profileMap.get(addr)

          lenderInfos.push({
            address: addr,
            name: profile?.name,
            image: profile?.image,
            lendingCap,
            minLendIR: minLendIRPercent,
            minLendIRRaw: minLendIR,
            available,
            usdcBalance,
            lent,
            owedPerSecond,
            timestamp,
            currentLent,
            capRemaining,
            rawAvailable,
          })
        }
      }

      return lenderInfos
    },
    enabled: !loadingTrust && trustedByAddresses.length > 0,
  })

  if (!address) return null

  if (loadingTrust) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-xl font-bold mb-4">Borrow from your Circle</h2>
        <p className="text-gray-500">Loading trust network...</p>
      </div>
    )
  }

  if (trustedByAddresses.length === 0) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-xl font-bold mb-4">Borrow from your Circle</h2>
        <p className="text-gray-500">None of the people who trust you have the module enabled</p>
      </div>
    )
  }

  if (loadingLenders) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-xl font-bold mb-4">Borrow from your Circle</h2>
        <p className="text-gray-500">Checking lending availability...</p>
      </div>
    )
  }

  const availableLenders = lenders || []

  if (availableLenders.length === 0) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-xl font-bold mb-4">Borrow from your Circle</h2>
        <p className="text-gray-500">
          None of your trusted contacts have the module enabled
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-xl font-bold mb-4">Available Lenders</h2>
        <p className="text-sm text-gray-600 mb-6">
          {availableLenders.length} contact{availableLenders.length !== 1 ? 's' : ''} available to lend
        </p>

        <div className="space-y-3">
          {availableLenders.map(lender => (
            <LenderCard key={lender.address} lender={lender} />
          ))}
        </div>
      </div>
    </div>
  )
}

function LenderCard({ lender }: { lender: LenderInfo }) {
  const { address: borrowerAddress } = useAccount()
  const [borrowAmount, setBorrowAmount] = useState('')

  const { writeContract, data: hash, isPending } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  const handleBorrow = () => {
    if (!borrowerAddress || !borrowAmount) return

    try {
      const amountInTokens = parseUnits(borrowAmount, 6)

      writeContract({
        address: MODULE_ADDRESS as `0x${string}`,
        abi: MODULE_ABI,
        functionName: 'borrow',
        args: [
          amountInTokens,
          [lender.address as `0x${string}`], // path: just the lender
          [lender.minLendIRRaw], // irs: use their minimum rate
        ],
      })
    } catch (err) {
      console.error('Failed to borrow:', err)
      alert('Invalid borrow amount')
    }
  }

  const maxBorrow = parseFloat(formatUnits(lender.available, 6)).toFixed(2)

  return (
    <div className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {lender.image ? (
            <img
              src={lender.image}
              alt={lender.name || 'Avatar'}
              className="w-12 h-12 rounded-full object-cover"
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center">
              <span className="text-gray-600 text-xs font-mono">
                {lender.address.slice(2, 4)}
              </span>
            </div>
          )}

          <div>
            {lender.name && (
              <p className="font-semibold text-sm">{lender.name}</p>
            )}
            <a
              href={`https://gnosisscan.io/address/${lender.address}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-gray-500 font-mono hover:text-gray-700 hover:underline"
            >
              {lender.address.slice(0, 6)}...{lender.address.slice(-4)}
            </a>
          </div>
        </div>

        <div className="text-right">
          <p className="text-sm font-semibold text-green-600">
            {parseFloat(formatUnits(lender.available, 6)).toFixed(2)} USDC.e
          </p>
          <p className="text-xs text-gray-500">
            @ {lender.minLendIR.toFixed(2)}% APR
          </p>
        </div>
      </div>

      {/* Borrow Form */}
      <div className="mt-4 pt-4 border-t">
        <label className="block text-xs text-gray-600 mb-2">Amount to borrow</label>
        <div className="flex gap-2">
          <div className="flex-1">
            <div className="flex items-center border rounded">
              <input
                type="text"
                value={borrowAmount}
                onChange={(e) => setBorrowAmount(e.target.value)}
                className="flex-1 px-3 py-2 text-sm border-0 outline-none"
                placeholder="0.00"
              />
              <span className="px-2 text-xs text-gray-500 border-l bg-gray-50">USDC.e</span>
            </div>
            <p className="text-xs text-gray-400 mt-1">Max: {maxBorrow} USDC.e</p>
          </div>
          <button
            onClick={handleBorrow}
            disabled={isPending || isConfirming || !borrowAmount}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed self-start"
          >
            {isPending || isConfirming ? 'Borrowing...' : 'Borrow'}
          </button>
        </div>
        {hash && (
          <div className="text-xs text-gray-600 mt-2">
            Transaction: {hash.slice(0, 10)}...{hash.slice(-8)}
            {isConfirming && ' (confirming...)'}
            {isSuccess && ' ✓'}
          </div>
        )}
      </div>

      {/* Debug info */}
      {/* <div className="mt-3 pt-3 border-t text-xs font-mono space-y-1">
        <div className="flex justify-between">
          <span className="text-gray-500">USDC Balance:</span>
          <span>{formatUnits(lender.usdcBalance, 6)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Lending Cap:</span>
          <span>{formatUnits(lender.lendingCap, 6)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Lent:</span>
          <span>{formatUnits(lender.lent, 6)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Owed/sec:</span>
          <span>{lender.owedPerSecond.toString()}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Timestamp:</span>
          <span>{lender.timestamp.toString()}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Current Lent:</span>
          <span>{formatUnits(lender.currentLent, 6)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Cap Remaining:</span>
          <span>{formatUnits(lender.capRemaining, 6)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Raw Available:</span>
          <span>{formatUnits(lender.rawAvailable, 6)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Available (98%):</span>
          <span>{formatUnits(lender.available, 6)}</span>
        </div>
      </div> */}
    </div>
  )
}
