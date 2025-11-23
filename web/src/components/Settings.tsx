import { useState, useEffect } from 'react'
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { formatUnits, parseUnits } from 'viem'
import { MODULE_ADDRESS } from '../config/constants'

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
  name: 'setSettings',
  type: 'function',
  stateMutability: 'nonpayable',
  inputs: [{
    name: '_limits',
    type: 'tuple',
    components: [
      { name: 'lendingCap', type: 'uint256' },
      { name: 'minLendIR', type: 'uint256' },
      { name: 'borrowCap', type: 'uint256' },
      { name: 'maxBorrowIR', type: 'uint256' },
      { name: 'minIRMargin', type: 'uint256' },
    ],
  }],
  outputs: [],
}] as const

export function Settings({ moduleEnabled }: { moduleEnabled?: boolean }) {
  const { address } = useAccount()

  const { data: limits, refetch } = useReadContract({
    address: MODULE_ADDRESS,
    abi: MODULE_ABI,
    functionName: 'limits',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
    },
  })

  const [lendingCap, setLendingCap] = useState('')
  const [minLendIR, setMinLendIR] = useState('')
  const [borrowCap, setBorrowCap] = useState('')
  const [maxBorrowIR, setMaxBorrowIR] = useState('')
  const [minIRMargin, setMinIRMargin] = useState('')

  const isConfigured = limits && (limits[0] > 0n || limits[1] > 0n || limits[2] > 0n)

  useEffect(() => {
    if (limits && isConfigured) {
      const SECONDS_PER_YEAR = 365 * 24 * 60 * 60
      setLendingCap(formatUnits(limits[0], 6))
      setMinLendIR((Number(limits[1]) / 1e18 * SECONDS_PER_YEAR * 100).toFixed(2))
      setBorrowCap(formatUnits(limits[2], 6))
      setMaxBorrowIR((Number(limits[3]) / 1e18 * SECONDS_PER_YEAR * 100).toFixed(2))
      setMinIRMargin((Number(limits[4]) / 1e18 * SECONDS_PER_YEAR * 100).toFixed(2))
    }
  }, [limits, isConfigured])

  const { writeContract, data: hash, isPending } = useWriteContract()

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  })

  useEffect(() => {
    if (isSuccess) {
      refetch()
    }
  }, [isSuccess, refetch])

  const handleSave = () => {
    if (!address) return

    try {
      const SECONDS_PER_YEAR = 365 * 24 * 60 * 60
      const settings = {
        lendingCap: parseUnits(lendingCap || '0', 6),
        minLendIR: BigInt(Math.floor(parseFloat(minLendIR || '0') / 100 / SECONDS_PER_YEAR * 1e18)),
        borrowCap: parseUnits(borrowCap || '0', 6),
        maxBorrowIR: BigInt(Math.floor(parseFloat(maxBorrowIR || '0') / 100 / SECONDS_PER_YEAR * 1e18)),
        minIRMargin: BigInt(Math.floor(parseFloat(minIRMargin || '0') / 100 / SECONDS_PER_YEAR * 1e18)),
      }

      writeContract({
        address: MODULE_ADDRESS,
        abi: MODULE_ABI,
        functionName: 'setSettings',
        args: [settings],
      })
    } catch (err) {
      console.error('Failed to save settings:', err)
      alert('Invalid settings values')
    }
  }

  if (!address || !moduleEnabled) return null

  const SECONDS_PER_YEAR = 365 * 24 * 60 * 60
  const currentLendingCap = limits ? formatUnits(limits[0], 6) : '0'
  const currentMinLendIR = limits ? (Number(limits[1]) / 1e18 * SECONDS_PER_YEAR * 100).toFixed(2) : '0'
  const currentBorrowCap = limits ? formatUnits(limits[2], 6) : '0'
  const currentMaxBorrowIR = limits ? (Number(limits[3]) / 1e18 * SECONDS_PER_YEAR * 100).toFixed(2) : '0'
  const currentMinIRMargin = limits ? (Number(limits[4]) / 1e18 * SECONDS_PER_YEAR * 100).toFixed(2) : '0'

  return (
    <>
      {isConfigured ? (
        <div className="bg-white p-6 rounded-lg shadow-md mb-6">
          <h2 className="text-lg font-bold mb-4">Current Settings</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Max lending:</span>
              <span className="font-semibold">{parseFloat(currentLendingCap).toFixed(2)} USDC.e @ {currentMinLendIR}%</span>
            </div>
            {parseFloat(currentBorrowCap) > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-600">Relaying:</span>
                <span className="font-semibold">{parseFloat(currentBorrowCap).toFixed(2)} USDC.e @ max {currentMaxBorrowIR}% (margin {currentMinIRMargin}%)</span>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-white p-6 rounded-lg shadow-md mb-6">
          <div className="text-sm text-gray-600">
            You haven't configured your lending settings yet
          </div>
        </div>
      )}

      <div className="bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-lg font-bold mb-4">{isConfigured ? 'Edit' : 'Setup'} Lending Settings</h2>

        <div className="space-y-4">
        <div className="flex gap-4 items-end">
          <div className="flex-1">
            <label className="block text-sm font-medium mb-1.5">Max lending amount</label>
            <div className="flex items-center border rounded">
              <input
                type="text"
                value={lendingCap}
                onChange={(e) => setLendingCap(e.target.value)}
                className="flex-1 px-3 py-2 text-sm border-0 outline-none"
                placeholder="100"
              />
              <span className="px-2 text-xs text-gray-500 border-l bg-gray-50">USDC.e</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Min interest rate</label>
            <div className="flex items-center border rounded" style={{width: '100px'}}>
              <input
                type="text"
                value={minLendIR}
                onChange={(e) => setMinLendIR(e.target.value)}
                className="flex-1 px-3 py-2 text-sm border-0 outline-none min-w-0"
                placeholder="5"
              />
              <span className="px-2 text-xs text-gray-500 border-l bg-gray-50">%</span>
            </div>
          </div>
        </div>

        <div className="border-t pt-4">
          <div className="mb-3">
            <h3 className="text-sm font-semibold">Relaying</h3>
            <p className="text-xs text-gray-500 mt-0.5">Autoborrow to autolend and satisfy lending paths (optional)</p>
          </div>

          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="block text-sm font-medium mb-1.5">Max borrow</label>
              <div className="flex items-center border rounded">
                <input
                  type="text"
                  value={borrowCap}
                  onChange={(e) => setBorrowCap(e.target.value)}
                  className="flex-1 px-3 py-2 text-sm border-0 outline-none min-w-0"
                  placeholder="0"
                />
                <span className="px-2 text-xs text-gray-500 border-l bg-gray-50">USDC.e</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">Max interest</label>
              <div className="flex items-center border rounded" style={{width: '100px'}}>
                <input
                  type="text"
                  value={maxBorrowIR}
                  onChange={(e) => setMaxBorrowIR(e.target.value)}
                  className="flex-1 px-3 py-2 text-sm border-0 outline-none min-w-0"
                  placeholder="10"
                />
                <span className="px-2 text-xs text-gray-500 border-l bg-gray-50">%</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">Min margin</label>
              <div className="flex items-center border rounded" style={{width: '100px'}}>
                <input
                  type="text"
                  value={minIRMargin}
                  onChange={(e) => setMinIRMargin(e.target.value)}
                  className="flex-1 px-3 py-2 text-sm border-0 outline-none min-w-0"
                  placeholder="1"
                />
                <span className="px-2 text-xs text-gray-500 border-l bg-gray-50">%</span>
              </div>
            </div>
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={isPending || isConfirming}
          className="w-full bg-[#ff6b35] text-white px-4 py-2 rounded-lg font-semibold hover:bg-[#ff5722] transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-2"
        >
          {isPending || isConfirming ? 'Saving...' : (isConfigured ? 'Update Settings' : 'Save Settings')}
        </button>

        {hash && (
          <div className="text-sm text-gray-600 text-center">
            Transaction: {hash.slice(0, 10)}...{hash.slice(-8)}
            {isConfirming && ' (confirming...)'}
            {isSuccess && ' ✓'}
          </div>
        )}
        </div>
      </div>
    </>
  )
}
