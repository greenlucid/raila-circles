import { useState } from 'react'
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { formatUnits, parseUnits } from 'viem'
import { useLendingPaths } from '../hooks/useLendingPaths'
import type { EnrichedLendingPath } from '../hooks/useLendingPaths'
import { MODULE_ADDRESS } from '../config/constants'

const MODULE_ABI = [{
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

const SECONDS_PER_YEAR = 365 * 24 * 60 * 60

function formatIR(ir: bigint): string {
  const aprPercent = Number(ir) / 1e18 * SECONDS_PER_YEAR * 100
  return aprPercent.toFixed(2)
}

export function Borrow() {
  const { address } = useAccount()

  const { data: paths, isLoading, error, currentDepth } = useLendingPaths(address)

  if (!address) return null

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h2 className="text-xl font-bold mb-4">Pathfinding Borrow</h2>

      {error && (
        <p className="text-red-600">Error: {error.message}</p>
      )}

      {!error && (
        <>
          {!isLoading && paths.length === 0 && (
            <p className="text-gray-500">
              No lending paths found. Try expanding your trust network or ask trusted contacts to enable the Raila module.
            </p>
          )}

          {/* Show initial skeleton when first loading */}
          {isLoading && paths.length === 0 && (
            <div className="border-2 border-gray-200 rounded-lg p-4 animate-pulse">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gray-200 rounded-full"></div>
                  <div>
                    <div className="h-4 bg-gray-200 rounded w-32 mb-1"></div>
                    <div className="h-3 bg-gray-200 rounded w-20"></div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="h-4 bg-gray-200 rounded w-24 mb-1"></div>
                  <div className="h-3 bg-gray-200 rounded w-16"></div>
                </div>
              </div>
              <div className="pt-3 border-t">
                <div className="h-3 bg-gray-200 rounded w-24 mb-2"></div>
                <div className="flex gap-2">
                  <div className="flex-1 h-10 bg-gray-200 rounded"></div>
                  <div className="w-24 h-10 bg-gray-200 rounded"></div>
                </div>
              </div>
            </div>
          )}

          {/* Show paths as they're discovered */}
          {paths.length > 0 && (
            <>
              <p className="text-sm text-gray-600 mb-4">
                Found {paths.length} lending path{paths.length !== 1 ? 's' : ''}
              </p>

              <div className="space-y-4">
                {paths.map((path, idx) => (
                  <PathCard key={idx} path={path} borrowerAddress={address} />
                ))}
              </div>
            </>
          )}

          {/* Loading indicator at the bottom (when we already have paths) */}
          {isLoading && paths.length > 0 && (
            <div className="mt-4 flex items-center justify-center gap-2 text-sm text-gray-600">
              <div className="animate-spin h-3 w-3 border-2 border-[#ff6b35] border-t-transparent rounded-full"></div>
              <span>
                {currentDepth !== null
                  ? `Checking distance ${currentDepth + 1}...`
                  : 'Starting pathfinding...'}
              </span>
            </div>
          )}

          {!isLoading && paths.length > 0 && (
            <p className="text-xs text-gray-500 mt-4 text-center">
              No more paths found
            </p>
          )}
        </>
      )}
    </div>
  )
}

function PathCard({ path, borrowerAddress }: { path: EnrichedLendingPath; borrowerAddress: string }) {
  const [borrowAmount, setBorrowAmount] = useState('')
  const [isExpanded, setIsExpanded] = useState(false)

  const { writeContract, data: hash, isPending } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  const handleBorrow = () => {
    if (!borrowAmount) return

    try {
      const amountInTokens = parseUnits(borrowAmount, 6)

      writeContract({
        address: MODULE_ADDRESS as `0x${string}`,
        abi: MODULE_ABI,
        functionName: 'borrow',
        args: [
          amountInTokens,
          path.path as `0x${string}`[],
          path.irs,
        ],
      })
    } catch (err) {
      console.error('Failed to borrow:', err)
      alert('Invalid borrow amount')
    }
  }

  const handleBorrowMax = () => {
    setBorrowAmount(formatUnits(path.sourceUSDC, 6))
  }

  const maxBorrow = parseFloat(formatUnits(path.sourceUSDC, 6)).toFixed(2)
  const finalIR = path.irs[path.irs.length - 1]

  // Build path visualization showing each hop with interest rates
  const pathHops = path.path.map((addr, i) => {
    const profile = path.profiles[i]
    const nextIR = path.irs[i]

    return { address: addr, profile, ir: nextIR }
  })

  return (
    <div className="border-2 border-gray-200 rounded-lg p-4 hover:border-[#ff6b35] transition-colors">
      {/* Header: Source and Final Rate */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          {path.sourceImage ? (
            <img
              src={path.sourceImage}
              alt={path.sourceName || 'Source'}
              className="w-10 h-10 rounded-full object-cover"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
              <span className="text-gray-600 text-xs font-mono">
                {path.path[0].slice(2, 4)}
              </span>
            </div>
          )}

          <div>
            <p className="font-semibold text-sm">
              {path.sourceName || `${path.path[0].slice(0, 6)}...${path.path[0].slice(-4)}`}
            </p>
            <p className="text-xs text-gray-500">
              {path.path.length === 1 ? 'Direct lender' : `${path.path.length}-hop path`}
            </p>
          </div>
        </div>

        <div className="text-right">
          <p className="text-sm font-semibold text-green-600">
            {maxBorrow} USDC.e
          </p>
          <p className="text-xs text-gray-500">
            @ {formatIR(finalIR)}% APR
          </p>
        </div>
      </div>

      {/* Path visualization (collapsible) */}
      {path.path.length > 1 && (
        <div className="mb-3">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-xs text-[#ff6b35] hover:text-[#ff5722] font-semibold flex items-center gap-1"
          >
            {isExpanded ? '▼' : '▶'} {isExpanded ? 'Hide' : 'Show'} path details
          </button>

          {isExpanded && (
            <div className="mt-3 p-3 bg-gray-50 rounded border border-gray-200">
              <div className="flex items-center gap-2 text-xs flex-wrap">
                {pathHops.map((hop, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="flex items-center gap-1 bg-white px-2 py-1 rounded border border-gray-300">
                      {hop.profile?.image && (
                        <img
                          src={hop.profile.image}
                          alt={hop.profile.name || hop.address}
                          className="w-4 h-4 rounded-full object-cover"
                        />
                      )}
                      <span className="font-mono">
                        {hop.profile?.name || `${hop.address.slice(0, 4)}...${hop.address.slice(-2)}`}
                      </span>
                    </div>

                    {i < pathHops.length - 1 ? (
                      <div className="flex items-center gap-1 text-gray-600">
                        <span>→</span>
                        <span className="font-semibold text-[#ff6b35]">{formatIR(hop.ir)}%</span>
                        <span>→</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-gray-600">
                        <span>→</span>
                        <span className="font-semibold text-[#ff6b35]">{formatIR(hop.ir)}%</span>
                        <span>→</span>
                        <span className="font-mono bg-blue-100 px-2 py-1 rounded border border-blue-300">
                          You
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Show margins for multi-hop */}
              {path.path.length > 1 && (
                <div className="mt-2 pt-2 border-t border-gray-300 space-y-1">
                  {path.path.slice(1).map((addr, i) => {
                    const profile = path.profiles[i + 1]
                    const payIR = path.irs[i]
                    const earnIR = path.irs[i + 1]
                    const margin = earnIR - payIR

                    return (
                      <div key={i} className="text-xs text-gray-600 flex items-center gap-1">
                        <span className="font-mono">
                          {profile?.name || `${addr.slice(0, 4)}...${addr.slice(-2)}`}
                        </span>
                        <span>makes</span>
                        <span className="font-semibold text-green-600">
                          {formatIR(margin)}%
                        </span>
                        <span>margin</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Borrow Form */}
      <div className="pt-3 border-t">
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
            <div className="flex justify-between items-center mt-1">
              <p className="text-xs text-gray-400">Available: {maxBorrow} USDC.e</p>
              <button
                onClick={handleBorrowMax}
                className="text-xs text-blue-600 hover:text-blue-700 font-semibold"
              >
                Max
              </button>
            </div>
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
    </div>
  )
}
