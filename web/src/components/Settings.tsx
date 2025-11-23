import { useState, useEffect } from 'react'
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { formatEther, parseEther } from 'viem'
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

  useEffect(() => {
    if (limits) {
      setLendingCap(formatEther(limits[0]))
      setMinLendIR((Number(limits[1]) / 1e18 * 100).toFixed(2))
      setBorrowCap(formatEther(limits[2]))
      setMaxBorrowIR((Number(limits[3]) / 1e18 * 100).toFixed(2))
      setMinIRMargin((Number(limits[4]) / 1e18 * 100).toFixed(2))
    }
  }, [limits])

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
      const settings = {
        lendingCap: parseEther(lendingCap || '0'),
        minLendIR: BigInt(Math.floor(parseFloat(minLendIR || '0') * 1e18 / 100)),
        borrowCap: parseEther(borrowCap || '0'),
        maxBorrowIR: BigInt(Math.floor(parseFloat(maxBorrowIR || '0') * 1e18 / 100)),
        minIRMargin: BigInt(Math.floor(parseFloat(minIRMargin || '0') * 1e18 / 100)),
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

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h2 className="text-xl font-bold mb-4">Lending Settings</h2>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Lending Cap (WXDAI)</label>
          <input
            type="number"
            value={lendingCap}
            onChange={(e) => setLendingCap(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg"
            placeholder="0"
            step="0.01"
          />
          <p className="text-xs text-gray-500 mt-1">Max amount of WXDAI you're willing to lend</p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Min Lending Interest Rate (%/year)</label>
          <input
            type="number"
            value={minLendIR}
            onChange={(e) => setMinLendIR(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg"
            placeholder="0"
            step="0.01"
          />
          <p className="text-xs text-gray-500 mt-1">Minimum interest rate to accept for lending</p>
        </div>

        <div className="border-t pt-4 mt-4">
          <h3 className="font-semibold mb-2">Autoborrow / Relaying</h3>
          <p className="text-xs text-gray-500 mb-3">Enable this if you want to act as a loan relayer</p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Borrow Cap (WXDAI)</label>
              <input
                type="number"
                value={borrowCap}
                onChange={(e) => setBorrowCap(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
                placeholder="0 = disabled"
                step="0.01"
              />
              <p className="text-xs text-gray-500 mt-1">Max WXDAI you'll autoborrow (0 to disable relaying)</p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Max Borrow Interest Rate (%/year)</label>
              <input
                type="number"
                value={maxBorrowIR}
                onChange={(e) => setMaxBorrowIR(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
                placeholder="0"
                step="0.01"
              />
              <p className="text-xs text-gray-500 mt-1">Max interest rate you'll pay when autoborr owing</p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Min IR Margin (%/year)</label>
              <input
                type="number"
                value={minIRMargin}
                onChange={(e) => setMinIRMargin(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
                placeholder="0"
                step="0.01"
              />
              <p className="text-xs text-gray-500 mt-1">Minimum margin between borrow and lend rates when relaying</p>
            </div>
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={isPending || isConfirming}
          className="w-full bg-[#ff6b35] text-white px-4 py-3 rounded-lg font-semibold hover:bg-[#ff5722] transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-6"
        >
          {isPending || isConfirming ? 'Saving...' : 'Save Settings'}
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
  )
}
