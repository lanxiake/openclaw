using System;
using System.Diagnostics;
using System.IO;

class Program {
    static int Main(string[] args) {
        string exePath = System.Reflection.Assembly.GetExecutingAssembly().Location;
        string dir = Path.GetDirectoryName(exePath);
        string realExe = Path.Combine(dir, "7za-real.exe");

        if (!File.Exists(realExe)) {
            Console.Error.WriteLine("7za-real.exe not found at: " + realExe);
            return 1;
        }

        // Rebuild arguments with proper quoting
        string arguments = "";
        for (int i = 0; i < args.Length; i++) {
            if (i > 0) arguments += " ";
            if (args[i].Contains(" ")) {
                arguments += "\"" + args[i] + "\"";
            } else {
                arguments += args[i];
            }
        }

        var psi = new ProcessStartInfo {
            FileName = realExe,
            Arguments = arguments,
            UseShellExecute = false
        };

        var proc = Process.Start(psi);
        proc.WaitForExit();
        int exitCode = proc.ExitCode;

        // Exit code 2 = warnings (e.g. symlink creation failed on Windows)
        // Convert to 0 (success) for electron-builder compatibility
        if (exitCode == 2) {
            return 0;
        }

        return exitCode;
    }
}
