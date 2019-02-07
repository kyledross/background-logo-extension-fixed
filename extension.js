/*
 * Copyright 2014 Red Hat, Inc
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation; either version 2, or (at your option)
 * any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, see <http://www.gnu.org/licenses/>.
 */
const Clutter = imports.gi.Clutter;
const Gio = imports.gi.Gio;
const St = imports.gi.St;

const Background = imports.ui.background;
const Layout = imports.ui.layout;
const Main = imports.ui.main;
const Tweener = imports.ui.tweener;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Convenience = Me.imports.convenience;

class BackgroundLogo {
    constructor(bgManager) {
        this._bgManager = bgManager;

        this._logoFile = null;

        this._settings = Convenience.getSettings();

        this._settings.connect('changed::logo-file',
                               this._updateLogo.bind(this));
        this._settings.connect('changed::logo-size',
                               this._updateScale.bind(this));
        this._settings.connect('changed::logo-position',
                               this._updatePosition.bind(this));
        this._settings.connect('changed::logo-border',
                               this._updateBorder.bind(this));
        this._settings.connect('changed::logo-always-visible',
                               this._updateVisibility.bind(this));

        this._textureCache = St.TextureCache.get_default();
        this._textureCache.connect('texture-file-changed', (cache, file) => {
            if (!this._logoFile || !this._logoFile.equal(file))
                return;
            this._updateLogoTexture();
        });

        this.actor = new St.Widget({ layout_manager: new Clutter.BinLayout(),
                                     opacity: 0 });
        bgManager._container.add_actor(this.actor);

        this.actor.connect('destroy', this._onDestroy.bind(this));

        let monitorIndex = bgManager._monitorIndex;
        let constraint = new Layout.MonitorConstraint({ index: monitorIndex,
                                                        work_area: true });
        this.actor.add_constraint(constraint);

        this._bin = new St.Widget({ x_expand: true, y_expand: true });
        this.actor.add_actor(this._bin);

        this._settings.bind('logo-opacity', this._bin, 'opacity',
                            Gio.SettingsBindFlags.DEFAULT);

        this._updateLogo();
        this._updatePosition();
        this._updateBorder();

        this._bgDestroyedId =
            bgManager.backgroundActor.connect('destroy',
                                              this._backgroundDestroyed.bind(this));

        this._bgChangedId =
            bgManager.connect('changed', this._updateVisibility.bind(this));
        this._updateVisibility();
    }

    _updateLogo() {
        let filename = this._settings.get_string('logo-file');
        let file = Gio.File.new_for_commandline_arg(filename);
        if (this._logoFile && this._logoFile.equal(file))
            return;

        this._logoFile = file;

        this._updateLogoTexture();
    }

    _updateLogoTexture() {
        if (this._icon)
            this._icon.destroy();

        let scaleFactor = St.ThemeContext.get_for_stage(global.stage).scale_factor;
        if (this._textureCache.load_file_async) { // > 3.14
            this._icon = this._textureCache.load_file_async(this._logoFile, -1, -1, scaleFactor);
        } else { // <= 3.14
            this._icon = this._textureCache.load_uri_async(this._logoFile.get_uri(), -1, -1, scaleFactor);
        }
        this._icon.connect('allocation-changed',
                           this._updateScale.bind(this));
        this._bin.add_actor(this._icon);
    }

    _updateScale() {
        if (this._icon.width == 0)
            return;

        let size = this._settings.get_double('logo-size');
        let width = this.actor.width * size / 100;
        let height = this._icon.height * width / this._icon.width;
        if (Math.abs(this._icon.height - height) < 1.0 &&
            Math.abs(this._icon.width - width) < 1.0) {
            // size of icon would not significantly change, so don't
            // update the size to avoid recursion in case the
            // manually set size differs just minimal from the eventually
            // allocated size
            return;
        }
        this._icon.set_size(width, height);
    }

    _updatePosition() {
        let xAlign, yAlign;
        switch (this._settings.get_string('logo-position')) {
            case 'center':
                xAlign = Clutter.ActorAlign.CENTER;
                yAlign = Clutter.ActorAlign.CENTER;
                break;
            case 'bottom-left':
                xAlign = Clutter.ActorAlign.START;
                yAlign = Clutter.ActorAlign.END;
                break;
            case 'bottom-center':
                xAlign = Clutter.ActorAlign.CENTER;
                yAlign = Clutter.ActorAlign.END;
                break;
            case 'bottom-right':
                xAlign = Clutter.ActorAlign.END;
                yAlign = Clutter.ActorAlign.END;
                break;
        }
        this._bin.x_align = xAlign;
        this._bin.y_align = yAlign;
    }

    _updateBorder() {
        let border = this._settings.get_uint('logo-border');
        this.actor.style = 'padding: %dpx;'.format(border);
    }

    _updateVisibility() {
        let background = this._bgManager.backgroundActor.background._delegate;
        let defaultUri = background._settings.get_default_value('picture-uri');
        let file = Gio.File.new_for_commandline_arg(defaultUri.deep_unpack());

        let visible;
        if (this._settings.get_boolean('logo-always-visible'))
            visible = true;
        else if (background._file) // > 3.14
            visible = background._file.equal(file);
        else if (background._filename) // <= 3.14
            visible = background._filename == file.get_path();
        else // background == NONE
            visible = false;

        Tweener.addTween(this.actor,
                         { opacity: visible ? 255 : 0,
                           time: Background.FADE_ANIMATION_TIME,
                           transition: 'easeOutQuad'
                         });
    }

    _backgroundDestroyed() {
        this._bgDestroyedId = 0;

        if (this._bgManager._backgroundSource) // background swapped
            this._bgDestroyedId =
                this._bgManager.backgroundActor.connect('destroy',
                                                        this._backgroundDestroyed.bind(this));
        else // bgManager destroyed
            this.actor.destroy();
    }

    _onDestroy() {
        this._settings.run_dispose();
        this._settings = null;

        if (this._bgDestroyedId)
            this._bgManager.backgroundActor.disconnect(this._bgDestroyedId);
        this._bgDestroyedId = 0;

        if (this._bgChangedId)
            this._bgManager.disconnect(this._bgChangedId);
        this._bgChangedId = 0;

        this._bgManager = null;

        this._logoFile = null;
    }
}


class Extension {
    constructor() {
        this._monitorsChangedId = 0;
        this._startupPreparedId = 0;
        this._logos = [];
    }

    _forEachBackgroundManager(func) {
        Main.overview._bgManagers.forEach(func);
        Main.layoutManager._bgManagers.forEach(func);
    }

    _addLogo() {
        this._destroyLogo();
        this._forEachBackgroundManager(bgManager => {
            this._logos.push(new BackgroundLogo(bgManager));
        });
    }

    _destroyLogo() {
        this._logos.forEach(l => { l.actor.destroy(); });
        this._logos = [];
    }

    enable() {
        this._monitorsChangedId =
            Main.layoutManager.connect('monitors-changed', this._addLogo.bind(this));
        this._startupPreparedId =
            Main.layoutManager.connect('startup-prepared', this._addLogo.bind(this));
        this._addLogo();
    }

    disable() {
        if (this._monitorsChangedId)
            Main.layoutManager.disconnect(this._monitorsChangedId);
        this._monitorsChangedId = 0;

        if (this._startupPreparedId)
            Main.layoutManager.disconnect(this._startupPreparedId);
        this._startupPreparedId = 0;

        this._destroyLogo();
    }
}

function init() {
    return new Extension();
}
