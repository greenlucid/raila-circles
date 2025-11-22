import { useState, useEffect } from 'react'
import { WagmiProvider, createConfig, http, useAccount, useConnect, useDisconnect, useSwitchChain } from 'wagmi'
import { gnosis } from 'wagmi/chains'
import { injected } from 'wagmi/connectors'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { HelpButton, HelpModal } from './components/HelpModal'
import { Sdk } from '@aboutcircles/sdk'
import { circlesConfig } from '@aboutcircles/sdk-core'

const wagmiConfig = createConfig({
  chains: [gnosis],
  connectors: [injected()],
  transports: {
    [gnosis.id]: http(),
  },
})

const queryClient = new QueryClient()

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
    <div className="flex flex-col gap-2 items-center">
      <div className="text-green-600 text-sm font-semibold">
        ✓ Circles Avatar
      </div>
      {profile && (
        <div className="flex flex-col items-center gap-2">
          {profile.previewImageUrl && (
            <img
              src={profile.previewImageUrl}
              alt={profile.name || 'Avatar'}
              className="w-16 h-16 rounded-full object-cover"
              onError={(e) => {
                console.error('Image failed to load')
                console.error('Tried to load:', profile.previewImageUrl?.substring(0, 100))
              }}
            />
          )}
          {profile.name && <div className="font-semibold text-center">{profile.name}</div>}
          {profile.description && <div className="text-xs text-gray-600 text-center">{profile.description}</div>}
        </div>
      )}
    </div>
  )
}

function ConnectButton() {
  const { address, isConnected, chain } = useAccount()
  const { connect, connectors } = useConnect()
  const { disconnect } = useDisconnect()
  const { switchChain } = useSwitchChain()

  if (!isConnected) {
    return (
      <button
        onClick={() => connect({ connector: connectors[0] })}
        className="bg-[#ff6b35] text-white px-6 py-3 rounded-lg font-semibold hover:bg-[#ff5722] transition-colors shadow-lg"
      >
        Connect Wallet
      </button>
    )
  }

  const isWrongChain = chain?.id !== gnosis.id

  return (
    <div className="flex flex-col gap-4 items-center p-6 bg-white rounded-lg shadow-md">
      <div className="text-sm text-center">
        <div className="font-mono text-gray-800 mb-2">
          {address?.slice(0, 6)}...{address?.slice(-4)}
        </div>
        <div className={`text-xs ${isWrongChain ? 'text-red-600 font-semibold' : 'text-gray-600'}`}>
          {chain?.name || 'Unknown Chain'}
        </div>
        {!isWrongChain && address && <CirclesInfo address={address} />}
      </div>

      {isWrongChain && (
        <button
          onClick={() => switchChain({ chainId: gnosis.id })}
          className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition-colors text-sm font-semibold"
        >
          Switch to Gnosis Chain
        </button>
      )}

      <button
        onClick={() => disconnect()}
        className="bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600 transition-colors text-sm"
      >
        Disconnect
      </button>
    </div>
  )
}

function App() {
  const [showHelp, setShowHelp] = useState(false)

  useEffect(() => {
    const seen = localStorage.getItem('raila-onboarding-seen')
    if (!seen) {
      setShowHelp(true)
    }
  }, [])

  const handleOnboardingComplete = () => {
    localStorage.setItem('raila-onboarding-seen', 'true')
    setShowHelp(false)
  }

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <div>
          <HelpButton onClick={() => setShowHelp(true)} />
          <HelpModal
            isOpen={showHelp}
            onClose={handleOnboardingComplete}
          />

          <div className="max-w-3xl mx-auto px-8">
            <h1 className="text-center mb-2 text-3xl font-bold">Raila Circles</h1>
            <p className="text-center text-gray-600 mb-12">
              Web of lending through Circles trust graph
            </p>

            <div className="flex justify-center mb-8">
              <ConnectButton />
            </div>
          </div>
        </div>
      </QueryClientProvider>
    </WagmiProvider>
  )
}

export default App
