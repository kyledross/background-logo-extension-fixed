# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

The Background Logo extension is a GNOME Shell extension that overlays customizable logos or watermarks on desktop backgrounds. It enhances the user experience by allowing users to add tasteful branding elements to their desktop environment. The extension supports:

- Configurable logo positioning (9 positions including corners, edges, and center)
- Size and opacity adjustments
- Separate logos for light and dark themes
- Border/margin controls
- Optional always-visible mode (shows logo even with custom backgrounds)

This is a mature extension that has been maintained since GNOME Shell 3.15 and supports modern GNOME Shell versions.

## Build System

This project uses the **Meson** build system for compilation and installation. Meson handles:

- GSettings schema compilation and installation
- Extension file deployment to system directories
- Integration with `gnome-extensions` CLI tool for packaging
- Dependency management and build configuration

The build system requires `meson`, `ninja`, and `glib-compile-schemas` to be available on the system.

## Development Commands

### Building and Installation
```bash path=null start=null
# Set up build directory
meson setup builddir

# Compile the extension
meson compile -C builddir

# Install to system directories (requires sudo)
sudo meson install -C builddir

# Alternative: Create zip package for manual installation
meson compile zip-file -C builddir
```

### Code Quality and Linting
```bash path=null start=null
# Run ESLint (requires Node.js and npm)
cd tools && npm clean-install && npm run lint

# Or use the convenience script
tools/run-eslint.sh
```

### Extension Management
```bash path=null start=null
# Install extension for current user
gnome-extensions install background-logo@fedorahosted.org.shell-extension.zip

# Enable the extension
gnome-extensions enable background-logo@fedorahosted.org

# Disable the extension
gnome-extensions disable background-logo@fedorahosted.org

# Uninstall the extension
gnome-extensions uninstall background-logo@fedorahosted.org

# Restart GNOME Shell to apply changes (X11 only)
# Press Alt+F2, type 'r', and press Enter
# For Wayland, log out and log back in
```

### Development Testing
```bash path=null start=null
# View extension logs in real-time
journalctl -f -o cat /usr/bin/gnome-shell

# Open GNOME Shell's Looking Glass debugger
# Press Alt+F2, type 'lg', and press Enter
```

## Architecture Overview

### Core Classes

**BackgroundLogo** (`extension.js`)
- Main class that manages logo overlay functionality
- Hooks into GNOME Shell's BackgroundManager to inject logos into background actors
- Handles settings monitoring and logo updates in response to configuration changes
- Manages logo visibility based on background type and user preferences
- Coordinates with the texture cache for logo loading and resource management

**IconContainer** (`extension.js`)
- Custom St.Widget subclass that handles logo scaling and positioning
- Provides preferred size calculations that respect scaling factors
- Works with Clutter's layout system for proper logo placement

**PreferencesWidget** (`prefs.js`)
- GTK4-based preferences dialog using Adwaita widgets
- Provides real-time preview of logo positioning and appearance
- Handles file selection for both light and dark theme logos
- Manages all extension settings through GSettings bindings

### Extension Integration Points

The extension integrates with GNOME Shell by:
1. **Method Injection**: Uses `InjectionManager` to override `BackgroundManager._createBackgroundActor()`
2. **Settings Integration**: Connects to GSettings schema for configuration persistence
3. **Theme Integration**: Automatically switches logos based on system color scheme
4. **Monitor Management**: Handles multi-monitor setups and layout changes
5. **Background Coordination**: Respects background changes and slideshow transitions

## File Structure

```
├── extension.js              # Main extension logic and BackgroundLogo class
├── prefs.js                  # GTK4 preferences dialog and settings UI
├── metadata.json.in          # Extension metadata template (processed by Meson)
├── meson.build              # Build configuration and installation rules
├── schemas/
│   └── *.gschema.xml        # GSettings schema defining extension preferences
├── tools/
│   ├── package.json         # NPM dependencies for development tools
│   ├── run-eslint.sh        # Convenience script for running ESLint
│   └── eslint.config.js     # ESLint configuration
├── eslint.config.js         # Symlink to tools/eslint.config.js
├── COPYING                  # GPL license text
└── NEWS                     # Release changelog
```

### Key Files

- **extension.js**: Contains the `BackgroundLogoExtension` class and the core `BackgroundLogo` widget implementation
- **prefs.js**: Implements the preferences UI with preview functionality using GTK4/Adwaita
- **schemas/*.gschema.xml**: Defines the settings schema including logo file paths, positioning, size, opacity, and visibility options
- **metadata.json.in**: Template for extension metadata that gets processed during build to include version and UUID
- **meson.build**: Handles compilation, schema installation, and packaging

## GNOME Shell Extension Development Workflow

### Development Setup
1. Make changes to source files in the repository
2. Use `meson compile -C builddir` to build
3. Install with `meson install -C builddir` or use zip packaging for user installation
4. Restart GNOME Shell or re-enable the extension to test changes

### Debugging and Logging
- Use `console.log()`, `console.error()`, or `console.warn()` for logging in extension code
- Monitor logs with `journalctl -f -o cat /usr/bin/gnome-shell`
- Use Looking Glass (`Alt+F2`, then `lg`) for interactive debugging and object inspection
- Test with `gnome-extensions prefs background-logo@fedorahosted.org` to open preferences

### Best Practices
- Always call `run_dispose()` on GSettings objects in cleanup methods
- Use `connect()` for signal connections and store connection IDs for proper cleanup
- Test extension enable/disable cycles to ensure proper resource cleanup
- Verify behavior across different monitor configurations and theme changes
- Follow GNOME Shell's coding conventions and use the provided ESLint configuration

### Version Compatibility
This extension targets GNOME Shell version compatibility based on the `shell-version` field in metadata.json. The current codebase supports modern GNOME Shell versions and uses:
- ES6+ JavaScript modules with import/export syntax
- GObject-based class definitions with `GObject.registerClass()`
- Modern GSettings and Gio APIs
- GTK4 for preferences UI