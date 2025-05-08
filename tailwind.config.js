/** @type {import('tailwindcss').Config} */
module.exports = {
  // Add darkMode strategy
  darkMode: 'class',

  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}', // Keep your existing content paths
  ],
  theme: {
    extend: {
      // Keep your existing theme extensions
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic':
          'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
      },
      // Add keyframes and animation utilities for button effect
      keyframes: {
        neonPulse: {
          '0%, 100%': {
             borderColor: 'rgba(6, 182, 212, 0.4)', // theme('colors.cyan.500') opacity 40%
             boxShadow: '0 0 5px rgba(6, 182, 212, 0.2), 0 0 10px rgba(6, 182, 212, 0.1)' 
            },
          '50%': { 
            borderColor: 'rgba(6, 182, 212, 1)', // theme('colors.cyan.500') opacity 100%
            boxShadow: '0 0 15px rgba(6, 182, 212, 0.4), 0 0 25px rgba(6, 182, 212, 0.3)' 
          },
        }
      },
      animation: {
        // Utility class: e.g., <button className="animate-neonPulse">...</button>
        neonPulse: 'neonPulse 2s infinite cubic-bezier(0.4, 0, 0.6, 1)', // Smoother easing
      }
    },
  },
  plugins: [
     // Add any other Tailwind plugins you might use here
  ],
}