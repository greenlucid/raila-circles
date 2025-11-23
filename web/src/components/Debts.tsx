import { useState, useEffect } from 'react'
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { MODULE_ADDRESS, SAFE_ABI, USDC_ADDRESS, ERC20_ABI } from '../config/constants'
import { formatUnits, parseUnits, createPublicClient, http } from 'viem'
import { gnosis } from 'wagmi/chains'
import { Sdk } from '@aboutcircles/sdk'
import { circlesConfig } from '@aboutcircles/sdk-core'
import { useQuery } from '@tanstack/react-query'

const MODULE_ABI = [{
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
  name: 'loans',
  type: 'function',
  stateMutability: 'view',
  inputs: [
    { name: 'lender', type: 'address' },
    { name: 'borrower', type: 'address' },
  ],
  outputs: [
    { name: 'amount', type: 'uint256' },
    { name: 'interestRatePerSecond', type: 'uint256' },
    { name: 'timestamp', type: 'uint256' },
  ],
}, {
  name: 'repay',
  type: 'function',
  stateMutability: 'nonpayable',
  inputs: [
    { name: 'amount', type: 'uint256' },
    { name: 'path', type: 'address[]' },
  ],
  outputs: [],
}] as const

const publicClient = createPublicClient({
  chain: gnosis,
  transport: http(),
})

interface LoanRelation {
  address: string
  name?: string
  image?: string
  amountOwed: bigint // if > 0, they owe me
  amountBorrowed: bigint // if > 0, I owe them
  interestRateOwed: number // APR % for what they owe me
  interestRateBorrowed: number // APR % for what I owe them
}

export function Debts() {
  const { address } = useAccount()
  const [circleAddresses, setCircleAddresses] = useState<string[]>([])
  const [loadingCircle, setLoadingCircle] = useState(true)

  const { data: balances } = useReadContract({
    address: MODULE_ADDRESS as `0x${string}`,
    abi: MODULE_ABI,
    functionName: 'balances',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
    },
  })

  // Fetch all trust relations (same logic as Borrow)
  useEffect(() => {
    if (!address) return

    const loadCircle = async () => {
      try {
        setLoadingCircle(true)
        const sdk = new Sdk(circlesConfig[100])
        const relations = await sdk.data.getTrustRelations(address)

        // Get all mutual trust addresses
        const trusters = relations
          .filter((rel: any) => rel.relation === 'mutuallyTrusts')
          .map((rel: any) =>
            rel.subjectAvatar === address ? rel.objectAvatar : rel.subjectAvatar
          )

        setCircleAddresses(trusters)
      } catch (err) {
        console.error('Failed to load circle:', err)
      } finally {
        setLoadingCircle(false)
      }
    }

    loadCircle()
  }, [address])

  // Fetch loan relationships with circle members who have module enabled
  const { data: loanRelations, isLoading: loadingLoans } = useQuery({
    queryKey: ['loans', address, circleAddresses],
    queryFn: async () => {
      if (!address || circleAddresses.length === 0) return []

      const sdk = new Sdk(circlesConfig[100])

      // Stage 1: Check module enabled
      const moduleCheckContracts = circleAddresses.map(addr => ({
        address: addr as `0x${string}`,
        abi: SAFE_ABI,
        functionName: 'isModuleEnabled',
        args: [MODULE_ADDRESS as `0x${string}`],
      }))

      const moduleResults = await publicClient.multicall({ contracts: moduleCheckContracts })
      const enabledAddresses = circleAddresses.filter((_, i) =>
        moduleResults[i].status === 'success' && moduleResults[i].result === true
      )

      if (enabledAddresses.length === 0) return []

      // Stage 2: Check loans both directions
      const loanContracts = enabledAddresses.flatMap(addr => [
        // Check if they owe me (I'm the lender)
        {
          address: MODULE_ADDRESS as `0x${string}`,
          abi: MODULE_ABI,
          functionName: 'loans',
          args: [address as `0x${string}`, addr as `0x${string}`],
        },
        // Check if I owe them (they're the lender)
        {
          address: MODULE_ADDRESS as `0x${string}`,
          abi: MODULE_ABI,
          functionName: 'loans',
          args: [addr as `0x${string}`, address as `0x${string}`],
        },
      ])

      const [loanResults, profiles] = await Promise.all([
        publicClient.multicall({ contracts: loanContracts }),
        Promise.all(enabledAddresses.map(async (addr) => {
          try {
            const avatarData = await sdk.data.getAvatar(addr as `0x${string}`)
            if (avatarData?.cidV0) {
              const profile = await sdk.profiles.get(avatarData.cidV0)
              return { addr, name: profile?.name, image: profile?.previewImageUrl }
            }
          } catch {}
          return { addr, name: undefined, image: undefined }
        }))
      ])

      const profileMap = new Map(profiles.map(p => [p.addr, p]))

      const SECONDS_PER_YEAR = 365 * 24 * 60 * 60
      const relations: LoanRelation[] = []

      for (let i = 0; i < enabledAddresses.length; i++) {
        const addr = enabledAddresses[i]
        const theyOweMe = loanResults[i * 2]
        const iOweThem = loanResults[i * 2 + 1]

        const amountOwed = theyOweMe.status === 'success'
          ? (theyOweMe.result as unknown as readonly [bigint, bigint, bigint])[0]
          : 0n
        const amountBorrowed = iOweThem.status === 'success'
          ? (iOweThem.result as unknown as readonly [bigint, bigint, bigint])[0]
          : 0n

        // Skip if no loans in either direction
        if (amountOwed === 0n && amountBorrowed === 0n) continue

        const interestRateOwedRaw = theyOweMe.status === 'success'
          ? (theyOweMe.result as unknown as readonly [bigint, bigint, bigint])[1]
          : 0n
        const interestRateBorrowedRaw = iOweThem.status === 'success'
          ? (iOweThem.result as unknown as readonly [bigint, bigint, bigint])[1]
          : 0n

        const interestRateOwed = Number(interestRateOwedRaw) / 1e18 * SECONDS_PER_YEAR * 100
        const interestRateBorrowed = Number(interestRateBorrowedRaw) / 1e18 * SECONDS_PER_YEAR * 100

        const profile = profileMap.get(addr)

        relations.push({
          address: addr,
          name: profile?.name,
          image: profile?.image,
          amountOwed,
          amountBorrowed,
          interestRateOwed,
          interestRateBorrowed,
        })
      }

      return relations
    },
    enabled: !loadingCircle && circleAddresses.length > 0,
  })

  if (!address) return null

  const borrowed = balances ? balances[2] : 0n
  const lent = balances ? balances[0] : 0n

  // Skip if no debts
  if (borrowed === 0n && lent === 0n) return null

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h2 className="text-xl font-bold mb-4">Your Loans</h2>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="border rounded-lg p-4">
          <p className="text-xs text-gray-500 mb-1">You owe</p>
          <p className="text-2xl font-bold text-red-600">
            {parseFloat(formatUnits(borrowed, 6)).toFixed(2)} USDC.e
          </p>
        </div>
        <div className="border rounded-lg p-4">
          <p className="text-xs text-gray-500 mb-1">You're owed</p>
          <p className="text-2xl font-bold text-green-600">
            {parseFloat(formatUnits(lent, 6)).toFixed(2)} USDC.e
          </p>
        </div>
      </div>

      {loadingLoans ? (
        <p className="text-sm text-gray-500">Loading loan details...</p>
      ) : loanRelations && loanRelations.length > 0 ? (
        <div className="space-y-3">
          {loanRelations.map(relation => (
            <LoanCard key={relation.address} relation={relation} />
          ))}
        </div>
      ) : (
        <p className="text-sm text-gray-500">No active loan relationships found</p>
      )}
    </div>
  )
}

function LoanCard({ relation }: { relation: LoanRelation }) {
  const { address: borrowerAddress } = useAccount()
  const [repayAmount, setRepayAmount] = useState('')

  // Check USDC allowance
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: USDC_ADDRESS as `0x${string}`,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: borrowerAddress ? [borrowerAddress, MODULE_ADDRESS as `0x${string}`] : undefined,
    query: {
      enabled: !!borrowerAddress && relation.amountBorrowed > 0n,
    },
  })

  const { writeContract, data: hash, isPending } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  useEffect(() => {
    if (isSuccess) {
      refetchAllowance()
    }
  }, [isSuccess, refetchAllowance])

  const handleApprove = () => {
    if (!borrowerAddress || !repayAmount) return

    try {
      const amountInTokens = parseUnits(repayAmount, 6)

      writeContract({
        address: USDC_ADDRESS as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [MODULE_ADDRESS as `0x${string}`, amountInTokens],
      })
    } catch (err) {
      console.error('Failed to approve:', err)
      alert('Approval failed')
    }
  }

  const handleRepay = () => {
    if (!borrowerAddress || !repayAmount || relation.amountBorrowed === 0n) return

    try {
      const amountInTokens = parseUnits(repayAmount, 6)

      writeContract({
        address: MODULE_ADDRESS as `0x${string}`,
        abi: MODULE_ABI,
        functionName: 'repay',
        args: [
          amountInTokens,
          [borrowerAddress as `0x${string}`, relation.address as `0x${string}`], // path: me -> lender
        ],
      })
    } catch (err) {
      console.error('Failed to repay:', err)
      alert('Invalid repay amount')
    }
  }

  const handleRepayMax = () => {
    // Add 1% buffer to cover accruing interest
    const maxWithBuffer = (relation.amountBorrowed * 101n) / 100n
    setRepayAmount(formatUnits(maxWithBuffer, 6))
  }

  const maxRepay = parseFloat(formatUnits(relation.amountBorrowed, 6)).toFixed(2)
  const repayAmountBigInt = repayAmount ? parseUnits(repayAmount, 6) : 0n
  const needsApproval = !allowance || allowance < repayAmountBigInt

  return (
    <div className="border rounded-lg p-4">
      <div className="flex items-center gap-3 mb-3">
        {relation.image ? (
          <img
            src={relation.image}
            alt={relation.name || 'Avatar'}
            className="w-10 h-10 rounded-full object-cover"
          />
        ) : (
          <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
            <span className="text-gray-600 text-xs font-mono">
              {relation.address.slice(2, 4)}
            </span>
          </div>
        )}
        <div>
          {relation.name && (
            <p className="font-semibold text-sm">{relation.name}</p>
          )}
          <a
            href={`https://gnosisscan.io/address/${relation.address}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-gray-500 font-mono hover:text-gray-700 hover:underline"
          >
            {relation.address.slice(0, 6)}...{relation.address.slice(-4)}
          </a>
        </div>
      </div>

      <div className="space-y-2 text-sm">
        {relation.amountBorrowed > 0n && (
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-600">You owe them:</span>
              <span className="font-semibold text-red-600">
                {parseFloat(formatUnits(relation.amountBorrowed, 6)).toFixed(2)} USDC.e @ {relation.interestRateBorrowed.toFixed(2)}% APR
              </span>
            </div>

            {/* Repay Form */}
            <div className="pt-2 border-t">
              <label className="block text-xs text-gray-600 mb-1">Repay amount</label>
              <div className="flex gap-2">
                <div className="flex-1">
                  <div className="flex items-center border rounded">
                    <input
                      type="text"
                      value={repayAmount}
                      onChange={(e) => setRepayAmount(e.target.value)}
                      className="flex-1 px-2 py-1 text-xs border-0 outline-none"
                      placeholder="0.00"
                    />
                    <span className="px-2 text-xs text-gray-500 border-l bg-gray-50">USDC.e</span>
                  </div>
                  <div className="flex justify-between items-center mt-1">
                    <p className="text-xs text-gray-400">Owed: ~{maxRepay} USDC.e</p>
                    <button
                      onClick={handleRepayMax}
                      className="text-xs text-blue-600 hover:text-blue-700 font-semibold"
                    >
                      Max (+1%)
                    </button>
                  </div>
                </div>
                {needsApproval ? (
                  <button
                    onClick={handleApprove}
                    disabled={isPending || isConfirming || !repayAmount}
                    className="bg-blue-600 text-white px-3 py-1 rounded text-xs font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed self-start"
                  >
                    {isPending || isConfirming ? 'Approving...' : 'Approve'}
                  </button>
                ) : (
                  <button
                    onClick={handleRepay}
                    disabled={isPending || isConfirming || !repayAmount}
                    className="bg-red-600 text-white px-3 py-1 rounded text-xs font-semibold hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed self-start"
                  >
                    {isPending || isConfirming ? 'Repaying...' : 'Repay'}
                  </button>
                )}
              </div>
              {hash && (
                <div className="text-xs text-gray-600 mt-2">
                  Transaction: {hash.slice(0, 10)}...{hash.slice(-8)}
                  {isConfirming && ' (confirming...)'}
                  {isSuccess && ' ✓'}
                </div>
              )}
            </div>
          </div>
        )}
        {relation.amountOwed > 0n && (
          <div className="flex justify-between">
            <span className="text-gray-600">They owe you:</span>
            <span className="font-semibold text-green-600">
              {parseFloat(formatUnits(relation.amountOwed, 6)).toFixed(2)} USDC.e @ {relation.interestRateOwed.toFixed(2)}% APR
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
