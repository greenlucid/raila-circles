import { useState } from 'react'

const slides = [
  {
    title: 'Add Your Wallet as External Owner',
    text: 'In Metri, Settings, add a wallet you control as an external owner.',
    screenshots: ['/screenshots/1.jpg', '/screenshots/2.jpg'],
  },
  {
    title: 'Connect Your Safe. You can find it in the QR icon at left of profile image.',
    text: 'Now connect with Rabby using your Safe wallet address. Connect Institutional Wallet -> Safe.',
    screenshots: ['/screenshots/3.jpg', '/screenshots/4.jpg'],
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
        className="bg-white rounded-2xl max-w-[900px] w-[90%] max-h-[90vh] overflow-y-auto p-8 shadow-[0_4px_24px_rgba(0,0,0,0.2)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center mb-6">
          <h2 className="mb-4 text-2xl">{slide.title}</h2>
          <p className="text-gray-600">{slide.text}</p>
        </div>

        <div className="flex gap-8 items-center">
          <div className="flex gap-6 justify-center flex-wrap flex-1">
            {slide.screenshots.map((src, i) => (
              <img
                key={i}
                src={src}
                alt={`Screenshot ${i + 1}`}
                className="w-64 rounded-xl shadow-lg"
              />
            ))}
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
              className="bg-[#ff6b35] text-white border-none px-8 py-3 rounded-lg text-base font-semibold cursor-pointer hover:bg-[#ff5722] transition-colors whitespace-nowrap"
            >
              {currentSlide < slides.length - 1 ? 'Next' : 'Get Started'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
