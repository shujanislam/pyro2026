export default function About() {
  return (
    <section className="py-20 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-black mb-4">
            Powerful Features
          </h2>
          <p className="text-gray-600 text-lg max-w-2xl mx-auto">
            Everything you need to understand your food in one intelligent platform
          </p>
        </div>

        {/* Feature boxes grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Prescription Analysis Box */}
          <div className="bg-white rounded-lg shadow-lg p-8 hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-center h-16 w-16 rounded-lg bg-lime-200 mb-6">
              <svg className="w-8 h-8 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-2xl font-bold text-black mb-3">
              Food Label Analysis
            </h3>
            <p className="text-gray-600 leading-relaxed">
              Upload food labels and get instant AI-powered analysis. Our smart system decodes ingredients, nutrition facts, and provides personalized insights about what you eat.
            </p>
          </div>

          {/* Voice Reply Support Box */}
          <div className="bg-white rounded-lg shadow-lg p-8 hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-center h-16 w-16 rounded-lg bg-lime-200 mb-6">
              <svg className="w-8 h-8 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4" />
              </svg>
            </div>
            <h3 className="text-2xl font-bold text-black mb-3">
              Voice Reply Support
            </h3>
            <p className="text-gray-600 leading-relaxed">
              Get responses in natural, conversational voice. Ask food questions and receive clear audio explanations, making nutrition info more accessible and personal.
            </p>
          </div>

          {/* Reminder Box */}
          <div className="bg-white rounded-lg shadow-lg p-8 hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-center h-16 w-16 rounded-lg bg-lime-200 mb-6">
              <svg className="w-8 h-8 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </div>
            <h3 className="text-2xl font-bold text-black mb-3">
              Personalized Results
            </h3>
            <p className="text-gray-600 leading-relaxed">
              Never miss dietary goals. Get intelligent suggestions tailored to your preferences, helping you stay on track with your nutrition goals.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
