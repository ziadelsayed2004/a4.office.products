using System;
using System.Diagnostics;
using System.IO;
using System.Windows.Forms;

internal static class A4CashierLauncher
{
    private const string IconCacheVersion = "14";
#if LOCAL_BUILD
    private const string AppUrl = "http://localhost:5173";
    private const string ProfileName = "CashierChromeLocalV14";
#else
    private const string AppUrl = "https://a4office.cloud";
    private const string ProfileName = "CashierChromeProductionV14";
#endif
    [STAThread]
    private static void Main(string[] args)
    {
        try
        {
            string chromePath = FindChrome();
            if (chromePath == null)
            {
                MessageBox.Show(
                    "Google Chrome is required to run A4 Cashier.",
                    "A4 Cashier",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Error
                );
                return;
            }

            string profilePath = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "A4Office",
                ProfileName
            );
            Directory.CreateDirectory(profilePath);
            RefreshFaviconCache(profilePath);

            var startInfo = new ProcessStartInfo
            {
                FileName = chromePath,
                Arguments =
                    "--user-data-dir=\"" + profilePath + "\" " +
                    "--kiosk-printing " +
                    "--no-first-run " +
                    "--no-default-browser-check " +
                    "--disable-background-mode " +
                    "--disable-extensions " +
                    "--disable-session-crashed-bubble " +
                    "--app=\"" + AppUrl + "\"",
                UseShellExecute = true,
                WorkingDirectory = Path.GetDirectoryName(chromePath)
            };
            Process.Start(startInfo);
        }
        catch (Exception error)
        {
            MessageBox.Show(
                "A4 Cashier could not start.\n\n" + error.Message,
                "A4 Cashier",
                MessageBoxButtons.OK,
                MessageBoxIcon.Error
            );
        }
    }

    private static void RefreshFaviconCache(string profilePath)
    {
        string markerPath = Path.Combine(profilePath, ".a4-icon-cache-version");
        try
        {
            if (File.Exists(markerPath) && File.ReadAllText(markerPath) == IconCacheVersion)
            {
                return;
            }

            string defaultProfile = Path.Combine(profilePath, "Default");
            foreach (string fileName in new[] { "Favicons", "Favicons-journal" })
            {
                string cacheFile = Path.Combine(defaultProfile, fileName);
                if (File.Exists(cacheFile))
                {
                    File.Delete(cacheFile);
                }
            }
            File.WriteAllText(markerPath, IconCacheVersion);
        }
        catch
        {
            // A locked Chrome cache must never prevent the cashier app from starting.
        }
    }

    private static string FindChrome()
    {
        string[] candidates =
        {
            Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles),
                "Google",
                "Chrome",
                "Application",
                "chrome.exe"
            ),
            Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86),
                "Google",
                "Chrome",
                "Application",
                "chrome.exe"
            )
        };

        foreach (string candidate in candidates)
        {
            if (File.Exists(candidate))
            {
                return candidate;
            }
        }
        return null;
    }
}
