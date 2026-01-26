import { LoginForm } from '@/components/login-form';

function AnimatedWaves() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Gradient background */}
      <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/10 rounded-full blur-3xl" />
      <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-primary/5 rounded-full blur-3xl" />

      {/* Animated waves */}
      <svg
        className="absolute bottom-0 left-0 w-full h-[60%] opacity-30 dark:opacity-20"
        viewBox="0 0 1440 400"
        preserveAspectRatio="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Wave 1 - Deepest, slowest */}
        <path
          className="fill-emerald-600/40 dark:fill-emerald-500/30"
          d="M0,300 C360,350 720,250 1080,300 C1260,325 1380,300 1440,280 L1440,400 L0,400 Z"
        >
          <animate
            attributeName="d"
            dur="8s"
            repeatCount="indefinite"
            values="
              M0,300 C360,350 720,250 1080,300 C1260,325 1380,300 1440,280 L1440,400 L0,400 Z;
              M0,280 C360,250 720,350 1080,280 C1260,265 1380,290 1440,310 L1440,400 L0,400 Z;
              M0,300 C360,350 720,250 1080,300 C1260,325 1380,300 1440,280 L1440,400 L0,400 Z
            "
          />
        </path>

        {/* Wave 2 - Middle layer */}
        <path
          className="fill-emerald-500/30 dark:fill-emerald-400/20"
          d="M0,320 C240,280 480,360 720,320 C960,280 1200,360 1440,320 L1440,400 L0,400 Z"
        >
          <animate
            attributeName="d"
            dur="6s"
            repeatCount="indefinite"
            values="
              M0,320 C240,280 480,360 720,320 C960,280 1200,360 1440,320 L1440,400 L0,400 Z;
              M0,340 C240,380 480,300 720,340 C960,380 1200,300 1440,340 L1440,400 L0,400 Z;
              M0,320 C240,280 480,360 720,320 C960,280 1200,360 1440,320 L1440,400 L0,400 Z
            "
          />
        </path>

        {/* Wave 3 - Top layer, fastest */}
        <path
          className="fill-emerald-400/20 dark:fill-emerald-300/15"
          d="M0,350 C180,320 360,380 540,350 C720,320 900,380 1080,350 C1260,320 1380,360 1440,350 L1440,400 L0,400 Z"
        >
          <animate
            attributeName="d"
            dur="4s"
            repeatCount="indefinite"
            values="
              M0,350 C180,320 360,380 540,350 C720,320 900,380 1080,350 C1260,320 1380,360 1440,350 L1440,400 L0,400 Z;
              M0,360 C180,390 360,330 540,360 C720,390 900,330 1080,360 C1260,390 1380,340 1440,360 L1440,400 L0,400 Z;
              M0,350 C180,320 360,380 540,350 C720,320 900,380 1080,350 C1260,320 1380,360 1440,350 L1440,400 L0,400 Z
            "
          />
        </path>
      </svg>

      {/* Top subtle wave */}
      <svg
        className="absolute top-0 left-0 w-full h-[30%] opacity-20 dark:opacity-10 rotate-180"
        viewBox="0 0 1440 200"
        preserveAspectRatio="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          className="fill-emerald-500/30 dark:fill-emerald-400/20"
          d="M0,100 C360,150 720,50 1080,100 C1260,125 1380,100 1440,80 L1440,200 L0,200 Z"
        >
          <animate
            attributeName="d"
            dur="10s"
            repeatCount="indefinite"
            values="
              M0,100 C360,150 720,50 1080,100 C1260,125 1380,100 1440,80 L1440,200 L0,200 Z;
              M0,80 C360,50 720,150 1080,80 C1260,65 1380,90 1440,110 L1440,200 L0,200 Z;
              M0,100 C360,150 720,50 1080,100 C1260,125 1380,100 1440,80 L1440,200 L0,200 Z
            "
          />
        </path>
      </svg>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4 overflow-hidden relative">
      {/* Background decorativo com ondas animadas */}
      <AnimatedWaves />

      <div className="w-full max-w-[320px] sm:max-w-md relative z-10">
        {/* Logo Section */}
        <div className="text-center mb-4 sm:mb-8">
          <div className="inline-flex mb-3 sm:mb-4">
            <img src="/sapo.png" alt="SapoConnect" className="w-40 h-40 sm:w-48 sm:h-48 object-contain" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold animate-in fade-in slide-in-from-bottom-2 duration-500">
            <span className="text-emerald-500 dark:text-emerald-400">Sapo</span>
            <span className="text-gray-900 dark:text-white">Connect</span>
          </h1>
          <p className="text-base text-gray-500 dark:text-gray-400 mt-2 animate-in fade-in slide-in-from-bottom-3 duration-500 delay-100">
            de{' '}
            <span
              className="italic font-semibold text-emerald-500/80 dark:text-emerald-400/80"
              style={{ fontFamily: "var(--font-playfair-display), Georgia, serif" }}
            >
              aluno
            </span>
            {' '}para{' '}
            <span className="relative inline-block">
              <span
                className="italic font-semibold text-emerald-500/80 dark:text-emerald-400/80"
                style={{ fontFamily: "var(--font-playfair-display), Georgia, serif" }}
              >
                aluno
              </span>
              {/* Crayon-style underline */}
              <svg
                className="absolute -bottom-1 left-0 w-full h-2 text-emerald-400/70 dark:text-emerald-500/60"
                viewBox="0 0 100 8"
                preserveAspectRatio="none"
              >
                <path
                  d="M2,5 Q25,3 50,5 T98,4"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  fill="none"
                />
              </svg>
            </span>
          </p>
        </div>

        {/* Login Form */}
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 delay-150">
          <LoginForm />
        </div>

        {/* Footer */}
        <p className="text-[10px] sm:text-xs text-center text-gray-400 dark:text-gray-500 mt-5 sm:mt-6 animate-in fade-in duration-700 delay-300 px-2 sm:px-0">
          Suas credenciais são criptografadas e armazenadas de forma segura apenas no seu dispositivo.
        </p>
      </div>
    </div>
  );
}
