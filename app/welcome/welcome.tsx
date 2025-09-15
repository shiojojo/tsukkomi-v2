export function Welcome() {
  // Resolve asset URLs relative to this module so Vite serves them correctly.
  const logoLight = new URL('./logo-light.svg', import.meta.url).href;
  const logoDark = new URL('./logo-dark.svg', import.meta.url).href;

  return (
    <main className="flex items-center justify-center pt-8 pb-4">
      <div className="text-center">
        {/* light / dark mode variants: show appropriate logo */}
        <img src={logoLight} alt="Tsukkomi logo" className="mx-auto w-48 h-auto dark:hidden" />
        <img src={logoDark} alt="Tsukkomi logo (dark)" className="mx-auto w-48 h-auto hidden dark:inline-block" />
      </div>
    </main>
  );
}
