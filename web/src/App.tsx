import { useState, useEffect } from 'react'
import { WagmiProvider, createConfig, http, useAccount, useConnect, useDisconnect, useSwitchChain, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { gnosis } from 'wagmi/chains'
import { injected } from 'wagmi/connectors'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { HelpButton, HelpModal } from './components/HelpModal'
import { Settings } from './components/Settings'
import { TrustNetwork } from './components/TrustNetwork'
import { Sdk } from '@aboutcircles/sdk'
import { circlesConfig } from '@aboutcircles/sdk-core'
import { MODULE_ADDRESS, SAFE_ABI } from './config/constants'

const wagmiConfig = createConfig({
  chains: [gnosis],
  connectors: [injected()],
  transports: {
    [gnosis.id]: http(),
  },
})

const queryClient = new QueryClient()

function EnableModule() {
  const { address, isConnected } = useAccount()

  const { data: moduleEnabled, refetch } = useReadContract({
    address: address,
    abi: SAFE_ABI,
    functionName: 'isModuleEnabled',
    args: [MODULE_ADDRESS as `0x${string}`],
    query: {
      enabled: !!address && isConnected,
    },
  })

  const { writeContract, data: hash, isPending } = useWriteContract()

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  })

  useEffect(() => {
    if (isSuccess) {
      refetch()
    }
  }, [isSuccess, refetch])

  const handleEnableModule = () => {
    if (!address) return

    writeContract({
      address: address,
      abi: SAFE_ABI,
      functionName: 'enableModule',
      args: [MODULE_ADDRESS as `0x${string}`],
    })
  }

  if (!isConnected) return null

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h2 className="text-xl font-bold mb-4">Raila Module</h2>
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-4">
          {moduleEnabled ? (
            <div className="text-green-600 font-semibold">✓ Module Enabled</div>
          ) : (
            <>
              <div className="text-gray-600">Module not enabled</div>
              <button
                onClick={handleEnableModule}
                disabled={isPending || isConfirming}
                className="bg-[#ff6b35] text-white px-4 py-2 rounded-lg hover:bg-[#ff5722] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isPending || isConfirming ? 'Enabling...' : 'Enable Module'}
              </button>
            </>
          )}
        </div>
        {hash && (
          <div className="text-sm text-gray-600">
            Transaction: {hash.slice(0, 10)}...{hash.slice(-8)}
            {isConfirming && ' (confirming...)'}
            {isSuccess && ' ✓'}
          </div>
        )}
      </div>
      <div className="text-xs text-gray-500 mt-2">
        Module: {MODULE_ADDRESS}
      </div>
    </div>
  )
}

function CirclesInfo({ address }: { address: string }) {
  const [avatarInfo, setAvatarInfo] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchAvatarInfo() {
      try {
        setLoading(true)
        setError(null)

        console.log('Fetching avatar info for:', address)

        // Create read-only SDK instance
        const sdk = new Sdk(circlesConfig[100])
        console.log('SDK initialized (read-only)')

        // Use sdk.data to check if avatar exists
        const avatarData = await sdk.data.getAvatar(address as `0x${string}`)
        console.log('Avatar data:', avatarData)

        if (avatarData) {
          setAvatarInfo(avatarData)

          // Fetch profile if CID exists
          if (avatarData.cidV0) {
            console.log('Fetching profile for CID:', avatarData.cidV0)
            const profileData = await sdk.profiles.get(avatarData.cidV0)
            console.log('Profile data:', profileData)
            console.log('Image URL:', profileData?.imageUrl)
            console.log('Preview Image URL:', profileData?.previewImageUrl)
            setProfile(profileData)
          }
        } else {
          setAvatarInfo(null)
          setProfile(null)
        }
      } catch (err) {
        console.error('Failed to fetch avatar info:', err)
        setError(err instanceof Error ? err.message : 'Failed to fetch avatar')
        setAvatarInfo(null)
        setProfile(null)
      } finally {
        setLoading(false)
      }
    }

    fetchAvatarInfo()
  }, [address])

  if (loading) {
    return <div className="text-gray-600 text-sm">Loading Circles info...</div>
  }

  if (error) {
    return <div className="text-red-600 text-sm">Error: {error}</div>
  }

  if (!avatarInfo) {
    return <div className="text-yellow-600 text-sm">Not a Circles avatar</div>
  }

  return (
    <div className="flex items-center gap-2">
      {profile?.previewImageUrl && (
        <img
          src={profile.previewImageUrl}
          alt={profile.name || 'Avatar'}
          className="w-8 h-8 rounded-full object-cover"
          onError={() => {
            console.error('Image failed to load')
            console.error('Tried to load:', profile.previewImageUrl?.substring(0, 100))
          }}
        />
      )}
      <div className="flex flex-col">
        {profile?.name && <div className="text-sm font-semibold">{profile.name}</div>}
        <div className="text-xs text-green-600">✓ Circles Avatar</div>
      </div>
    </div>
  )
}

function ConnectButton() {
  const { address, isConnected, chain } = useAccount()
  const { connect, connectors } = useConnect()
  const { disconnect } = useDisconnect()
  const { switchChain } = useSwitchChain()
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    if (address) {
      navigator.clipboard.writeText(address)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  if (!isConnected) {
    return (
      <button
        onClick={() => connect({ connector: connectors[0] })}
        className="bg-[#ff6b35] text-white px-4 py-2 rounded-lg font-semibold hover:bg-[#ff5722] transition-colors"
      >
        Connect Wallet
      </button>
    )
  }

  const isWrongChain = chain?.id !== gnosis.id

  return (
    <div className="flex items-center gap-3 p-3 bg-white rounded-lg shadow-md relative">
      {!isWrongChain && address && <CirclesInfo address={address} />}

      <div className="flex flex-col items-end gap-1">
        <div className="flex items-center gap-1">
          <a
            href={`https://app.safe.global/home?safe=gno:${address}`}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-xs text-gray-600 hover:text-gray-800"
          >
            {address?.slice(0, 6)}...{address?.slice(-4)}
          </a>
          <button
            onClick={handleCopy}
            className="text-gray-500 hover:text-gray-700 p-1"
            title="Copy address"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </button>
        </div>
        {isWrongChain ? (
          <button
            onClick={() => switchChain({ chainId: gnosis.id })}
            className="bg-red-500 text-white px-2 py-1 rounded text-xs hover:bg-red-600"
          >
            Switch to Gnosis
          </button>
        ) : (
          <button
            onClick={() => disconnect()}
            className="bg-gray-500 text-white px-2 py-1 rounded text-xs hover:bg-gray-600"
          >
            Disconnect
          </button>
        )}
      </div>

      {copied && (
        <div className="absolute bottom-1 right-3 text-xs text-green-600 bg-white px-2 py-1 rounded shadow-sm">
          Copied!
        </div>
      )}
    </div>
  )
}

function App() {
  const [showHelp, setShowHelp] = useState(() => {
    const seen = localStorage.getItem('raila-onboarding-seen')
    return !seen
  })

  const handleOnboardingComplete = () => {
    localStorage.setItem('raila-onboarding-seen', 'true')
    setShowHelp(false)
  }

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <div>
          <HelpModal
            isOpen={showHelp}
            onClose={handleOnboardingComplete}
          />

          <div className="fixed top-4 right-4 flex items-center gap-3 z-10">
            <HelpButton onClick={() => setShowHelp(true)} />
            <ConnectButton />
          </div>

          <div className="max-w-3xl mx-auto px-8 py-6">
            <div className="mb-8">
              <h1 className="text-3xl font-bold">Raila Circles</h1>
              <p className="text-gray-600 mt-1">
                Web of lending through Circles trust graph
              </p>
            </div>

            <div className="space-y-6">
              <EnableModule />
              <Settings />
              <TrustNetwork />
            </div>
          </div>
        </div>
      </QueryClientProvider>
    </WagmiProvider>
  )
}

export default App
