# Dusk on Nix

The `flake.nix` exposes three things:

- `packages.dusk` (also `packages.default`) — the installable app
- `overlays.default` — an overlay for nixpkgs
- `devShells.default` — a shell for hacking on Dusk

## Install into your system config (Flakes)

Add the input:

```nix
{
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    dusk.url = "github:rootscripts/dusk";
  };

  outputs = { self, nixpkgs, dusk, ... }: {
    nixosConfigurations.myhost = nixpkgs.lib.nixosSystem {
      system = "x86_64-linux";
      modules = [
        ({ pkgs, ... }: {
          environment.systemPackages = [ dusk.packages.x86_64-linux.default ];
        })
      ];
    };
  };
}
```

For home-manager, inside your home config:

```nix
{
  inputs.dusk.url = "github:rootscripts/dusk";

  outputs = { nixpkgs, home-manager, dusk, ... }: {
    homeConfigurations.you = home-manager.lib.homeManagerConfiguration {
      pkgs = nixpkgs.legacyPackages.x86_64-linux;
      modules = [
        ({ pkgs, ... }: {
          home.packages = [ dusk.packages.x86_64-linux.default ];
        })
      ];
    };
  };
}
```

## Install via an overlay

Useful when you want `pkgs.dusk` available everywhere rather than referencing `dusk.packages...` directly:

```nix
{
  inputs.dusk.url = "github:rootscripts/dusk";

  outputs = { nixpkgs, dusk, ... }:
    let
      system = "x86_64-linux";
      pkgs = import nixpkgs {
        inherit system;
        overlays = [ dusk.overlays.default ];
      };
    in {
      nixosConfigurations.myhost = pkgs.lib.nixosSystem {
        inherit system;
        modules = [{ environment.systemPackages = [ pkgs.dusk ]; }];
      };
    };
}
```

## One-off / user installs (no config change)

```bash
# install into your profile
nix profile install github:rootscripts/dusk

# or just run it once
nix run github:rootscripts/dusk

# from a local checkout
nix profile install .
nix run .
```

After installing, `dusk` is on your `PATH` and a `Dusk` desktop entry + icon are registered.

## Development shell

```bash
git clone https://github.com/rootscripts/riff
cd dusk
nix develop          # nodejs, python3, yt-dlp, ffmpeg
npm install
npm start
```

## Notes

- The package wraps the nixpkgs `electron` with the app directory and puts `yt-dlp` and `ffmpeg` on `PATH`, so Dusk finds them instead of self-downloading.
- `npmDepsHash` in `flake.nix` must be updated whenever `package.json`/`package-lock.json` change. Rebuild with a wrong/placeholder hash and copy the reported `got:` value, or regenerate it with `nix-prefetch-npm-deps` / `prefetch-npm-deps`.
