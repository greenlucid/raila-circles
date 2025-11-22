import { useState, useEffect } from 'react'
import { WagmiProvider, createConfig, http } from 'wagmi'
import { gnosis } from 'wagmi/chains'
import { injected } from 'wagmi/connectors'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { HelpButton, HelpModal } from './components/HelpModal'

const wagmiConfig = createConfig({
  chains: [gnosis],
  connectors: [injected()],
  transports: {
    [gnosis.id]: http(),
  },
})

const queryClient = new QueryClient()

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

            {/* TODO: Add actual content here */}
          </div>
        </div>
      </QueryClientProvider>
    </WagmiProvider>
  )
}

export default App
