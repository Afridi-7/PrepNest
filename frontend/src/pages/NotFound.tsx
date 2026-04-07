const NotFound = () => {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-muted to-background px-4">
      <div className="text-center bg-card border border-border rounded-2xl p-8 shadow-card max-w-sm w-full">
        <h1 className="mb-3 text-5xl font-bold">404</h1>
        <p className="mb-6 text-base sm:text-lg text-muted-foreground">Oops! Page not found</p>
        <a href="/" className="inline-block text-primary underline hover:text-primary/90 font-medium">
          Return to Home
        </a>
      </div>
    </div>
  );
};

export default NotFound;
