using System;
using System.Diagnostics;
using System.IO;
using System.Windows.Forms;

internal static class A4CashierLauncher
{
#if LOCAL_BUILD
    private const string AppUrl = "http://localhost:5173";
    private const string ProfileName = "CashierChromeLocal";
#else
    private const string AppUrl = "https://a4office.cloud";
    private const string ProfileName = "CashierChromeProduction";
#endif
    private const string PrinterName = "POSPrinter POS80";

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

            ConfigureDirectPrinting();

            string profilePath = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "A4Office",
                ProfileName
            );
            Directory.CreateDirectory(profilePath);

            var startInfo = new ProcessStartInfo
            {
                FileName = chromePath,
                Arguments =
                    "--user-data-dir=\"" + profilePath + "\" " +
                    "--kiosk-printing " +
                    "--no-first-run " +
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

    private static void ConfigureDirectPrinting()
    {
        var setDefaultPrinter = new ProcessStartInfo
        {
            FileName = "rundll32.exe",
            Arguments = "printui.dll,PrintUIEntry /y /n \"" + PrinterName + "\"",
            UseShellExecute = false,
            CreateNoWindow = true,
            WindowStyle = ProcessWindowStyle.Hidden
        };
        using (Process process = Process.Start(setDefaultPrinter))
        {
            if (process != null) process.WaitForExit(5000);
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
