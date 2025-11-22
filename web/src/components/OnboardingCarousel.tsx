import { useState } from 'react'

const slides = [
  {
    title: 'Welcome to Raila Circles',
    text: 'You need to import your Metri wallet to get started.',
    screenshots: 3,
  },
  {
    title: 'Connect Your Safe',
    text: 'Now connect with your Safe wallet using WalletConnect.',
    screenshots: 2,
  },
]

export function OnboardingCarousel({ onComplete }: { onComplete: () => void }) {
  const [currentSlide, setCurrentSlide] = useState(0)

  const handleNext = () => {
    if (currentSlide < slides.length - 1) {
      setCurrentSlide(currentSlide + 1)
    } else {
      onComplete()
    }
  }

  const slide = slides[currentSlide]

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-[1000]"
      onClick={onComplete}
    >
      <div
        className="bg-white rounded-2xl max-w-[600px] w-[90%] p-8 shadow-[0_4px_24px_rgba(0,0,0,0.2)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center">
          <h2 className="mb-4 text-2xl">{slide.title}</h2>
          <p className="text-gray-600 mb-8">{slide.text}</p>

          <div className="flex gap-4 justify-center mb-8 flex-wrap">
            {Array.from({ length: slide.screenshots }).map((_, i) => (
              <div
                key={i}
                className="w-40 h-[280px] bg-gradient-to-br from-[#ff9a56] to-[#ff6b35] rounded-xl opacity-90 shadow-[0_2px_8px_rgba(255,107,53,0.3)]"
              />
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-6 items-center">
          <div className="flex gap-2">
            {slides.map((_, i) => (
              <div
                key={i}
                className={`h-2 rounded-full transition-all duration-200 ${
                  i === currentSlide
                    ? 'bg-[#ff6b35] w-6'
                    : 'bg-gray-300 w-2'
                }`}
              />
            ))}
          </div>
          <button
            onClick={handleNext}
            className="bg-[#ff6b35] text-white border-none px-8 py-3 rounded-lg text-base font-semibold cursor-pointer hover:bg-[#ff5722] transition-colors"
          >
            {currentSlide < slides.length - 1 ? 'Next' : 'Get Started'}
          </button>
        </div>
      </div>
    </div>
  )
}
