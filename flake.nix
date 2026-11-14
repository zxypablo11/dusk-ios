{
  description = "Dusk - a desktop audio player (Electron)";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils, ... }:
    let
      mkMuriel = pkgs:
        pkgs.buildNpmPackage rec {
          pname = "dusk";
          version = "42.0.0";
          src = self;

          npmDepsHash = "sha256-fptxs7GYEi3F9BTI6amByNVcX28QElIE6e0baFr4WzI=";

          ELECTRON_SKIP_BINARY_DOWNLOAD = "1";
          forceGitDeps = true;
          npmInstallFlags = [ "--omit=dev" ];

          buildPhase = "true";

          installPhase =
            let
              appDir = "$out/share/dusk";
              runtimeDeps = pkgs.lib.makeBinPath [ pkgs.yt-dlp pkgs.ffmpeg ];
              desktop = pkgs.makeDesktopItem {
                name = "Dusk";
                desktopName = "Dusk";
                genericName = "Audio Player";
                exec = "dusk";
                icon = "dusk";
                categories = [ "AudioVideo" "Audio" "Player" ];
                startupWMClass = "dusk";
              };
            in
            ''
              runHook preInstall

              mkdir -p ${appDir}
              for f in *; do cp -r "$f" ${appDir}/; done

              mkdir -p $out/bin
              makeWrapper ${pkgs.electron}/bin/electron $out/bin/dusk \
                --add-flags ${appDir} \
                --prefix PATH : ${runtimeDeps}

              mkdir -p $out/share/applications
              cp ${desktop}/share/applications/*.desktop $out/share/applications/

              mkdir -p $out/share/icons/hicolor/256x256/apps
              cp ${appDir}/assets/icon.png $out/share/icons/hicolor/256x256/apps/dusk.png

              runHook postInstall
            '';

          meta = with pkgs.lib; {
            description = "Dusk - audio player made for humans";
            homepage = "https://github.com/cloverscripts/riff-muriel";
            license = licenses.mit;
            mainProgram = "dusk";
            platforms = platforms.linux ++ platforms.darwin;
          };
        };
    in
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs { inherit system; };
      in
      {
        packages = {
          default = mkMuriel pkgs;
          dusk = mkMuriel pkgs;
        };

        devShells.default = pkgs.mkShell {
          packages = with pkgs; [
            nodejs
            python3
            yt-dlp
            ffmpeg
          ];

          shellHook = ''
            echo "Dusk dev shell. Install deps and run with:"
            echo "  npm install && npm start"
          '';
        };
      })
    // {
      overlays.default = final: prev: {
        dusk = mkMuriel final;
      };
    };
}
