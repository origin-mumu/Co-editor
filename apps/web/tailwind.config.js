/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: '#3E6FDC',
          hover: '#325ec2',
          active: '#284da3',
          subtle: 'rgba(62, 111, 220, 0.1)',
          glow: 'rgba(62, 111, 220, 0.2)'
        },
        app: {
          bg: '#F2F2F7',
          surface: 'rgba(255, 255, 255, 0.82)',
          solid: '#ffffff',
          hover: 'rgba(120, 120, 128, 0.08)'
        }
      },
      borderRadius: {
        pill: '9999px',
        card: '18px',
        panel: '24px'
      },
      boxShadow: {
        'soft-sm': '0 1px 3px rgba(0, 0, 0, 0.03), 0 2px 6px rgba(0, 0, 0, 0.02)',
        'soft-md': '0 4px 16px -2px rgba(0, 0, 0, 0.04), 0 1px 3px rgba(0, 0, 0, 0.02)',
        'soft-lg': '0 8px 24px -4px rgba(0, 0, 0, 0.06), 0 2px 8px rgba(0, 0, 0, 0.03)'
      }
    }
  },
  plugins: []
};
