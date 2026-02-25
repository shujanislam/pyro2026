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
            Everything you need to understand your medical documents in one intelligent platform
          </p>
        </div>

        {/* Feature boxes grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Lab Reports */}
          <div className="bg-white rounded-lg shadow-lg p-6 hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-center h-14 w-14 rounded-lg bg-teal-100 mb-5">
              <svg className="w-7 h-7 text-teal-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-black mb-2">
              Lab Report Analysis
            </h3>
            <p className="text-gray-600 text-sm leading-relaxed">
              Upload blood tests or imaging reports. Get plain-language explanations of every value — no medical degree needed.
            </p>
          </div>

          {/* Insurance Checker */}
          <div className="bg-white rounded-lg shadow-lg p-6 hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-center h-14 w-14 rounded-lg bg-purple-100 mb-5">
              <svg className="w-7 h-7 text-purple-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-black mb-2">
              Insurance Checker
            </h3>
            <p className="text-gray-600 text-sm leading-relaxed">
              Upload your policy + hospital estimate. Our AI flags likely rejections, checks room-rent limits, and tells you exactly what to do next.
            </p>
          </div>

          {/* Multilingual Voice */}
          <div className="bg-white rounded-lg shadow-lg p-6 hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-center h-14 w-14 rounded-lg bg-teal-100 mb-5">
              <svg className="w-7 h-7 text-teal-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-black mb-2">
              Multilingual Voice
            </h3>
            <p className="text-gray-600 text-sm leading-relaxed">
              Hear explanations read aloud in 10 Indian languages — Hindi, Bengali, Assamese, Tamil, and more — powered by ElevenLabs voice AI.
            </p>
          </div>

          {/* Privacy First */}
          <div className="bg-white rounded-lg shadow-lg p-6 hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-center h-14 w-14 rounded-lg bg-amber-100 mb-5">
              <svg className="w-7 h-7 text-amber-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-black mb-2">
              Privacy & Safety
            </h3>
            <p className="text-gray-600 text-sm leading-relaxed">
              Documents are never stored. Every result carries a clear disclaimer — AI explanations are for education only, not a substitute for your doctor.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
