using System;
using System.Diagnostics;
using System.Collections.Generic;
using System.IO;
using System.Text;
using System.Web.Script.Serialization;
using System.Windows.Forms;
using Microsoft.Win32;

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
            ConfigureThermalPrintPreferences(profilePath);

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

    private static void ConfigureThermalPrintPreferences(string profilePath)
    {
        string defaultProfile = Path.Combine(profilePath, "Default");
        string preferencesPath = Path.Combine(defaultProfile, "Preferences");
        string temporaryPath = preferencesPath + ".a4.tmp";
        try
        {
            Directory.CreateDirectory(defaultProfile);
            var serializer = new JavaScriptSerializer { MaxJsonLength = int.MaxValue };
            Dictionary<string, object> preferences = new Dictionary<string, object>();
            if (File.Exists(preferencesPath))
            {
                preferences = serializer.Deserialize<Dictionary<string, object>>(
                    File.ReadAllText(preferencesPath, Encoding.UTF8)
                );
                if (preferences == null) return;
            }

            Dictionary<string, object> printing = GetOrCreateDictionary(preferences, "printing");
            Dictionary<string, object> sticky = GetOrCreateDictionary(
                printing,
                "print_preview_sticky_settings"
            );
            Dictionary<string, object> appState = new Dictionary<string, object>();
            object serializedState;
            if (sticky.TryGetValue("appState", out serializedState) && serializedState is string)
            {
                try
                {
                    appState = serializer.Deserialize<Dictionary<string, object>>(
                        (string)serializedState
                    ) ?? appState;
                }
                catch
                {
                    // Replace only the broken print-preview state, not the profile.
                }
            }

            appState["version"] = 2;
            appState["isHeaderFooterEnabled"] = false;
            appState["marginsType"] = 1;
            appState["isFitToPageEnabled"] = false;
            appState["isCssBackgroundEnabled"] = true;
            appState["scaling"] = "100";
            appState.Remove("mediaSize");
            sticky["appState"] = serializer.Serialize(appState);

            File.WriteAllText(temporaryPath, serializer.Serialize(preferences), new UTF8Encoding(false));
            File.Copy(temporaryPath, preferencesPath, true);
            File.Delete(temporaryPath);
        }
        catch
        {
            try
            {
                if (File.Exists(temporaryPath)) File.Delete(temporaryPath);
            }
            catch { }
            // Chrome can still start if its preference file is locked or malformed.
        }
    }

    private static Dictionary<string, object> GetOrCreateDictionary(
        Dictionary<string, object> parent,
        string key
    )
    {
        object value;
        var dictionary = parent.TryGetValue(key, out value)
            ? value as Dictionary<string, object>
            : null;
        if (dictionary == null)
        {
            dictionary = new Dictionary<string, object>();
            parent[key] = dictionary;
        }
        return dictionary;
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
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "Google",
                "Chrome",
                "Application",
                "chrome.exe"
            ),
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

        string[] registryKeys =
        {
            @"HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\App Paths\chrome.exe",
            @"HKEY_LOCAL_MACHINE\Software\Microsoft\Windows\CurrentVersion\App Paths\chrome.exe",
            @"HKEY_LOCAL_MACHINE\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\App Paths\chrome.exe"
        };
        foreach (string registryKey in registryKeys)
        {
            string registryPath = Registry.GetValue(registryKey, "", null) as string;
            if (!string.IsNullOrWhiteSpace(registryPath) && File.Exists(registryPath))
            {
                return registryPath;
            }
        }
        return null;
    }
}
