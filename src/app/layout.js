import "@/styles/globals.css";

export const metadata = {
  title: "Project & Task Tracker",
  description: "Internal project and task tracking tool",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        {/* Runs before paint, before React hydrates — reads the saved theme (or system
            preference) and sets it on <html> immediately, so there's no flash of the wrong
            theme on load. This has to be a plain inline script, not a React effect, because
            an effect only runs after the first paint. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function () {
                try {
                  var stored = localStorage.getItem("theme");
                  var theme = stored || (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");
                  document.documentElement.setAttribute("data-theme", theme);
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
