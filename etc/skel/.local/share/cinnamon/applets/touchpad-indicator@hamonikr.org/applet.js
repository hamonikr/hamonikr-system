/*
 *    Cinnamon DE panel applet to show unwritten data amount and initiate sync
 *    Copyright (C) 2024  Kevin Kim
 *
 *    This program is free software: you can redistribute it and/or modify
 *    it under the terms of the GNU General Public License as published by
 *    the Free Software Foundation, either version 3 of the License, or
 *    (at your option) any later version.
 *
 *    This program is distributed in the hope that it will be useful,
 *    but WITHOUT ANY WARRANTY; without even the implied warranty of
 *    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *    GNU General Public License for more details.
 *
 *    You should have received a copy of the GNU General Public License
 *    along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

const Lang = imports.lang;
const Applet = imports.ui.applet;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Gettext = imports.gettext;
const PopupMenu = imports.ui.popupMenu;
const St = imports.gi.St;
const UUID = "touchpad-indicator@hamonikr.org";

Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale");

function _(str) {
    return Gettext.dgettext(UUID, str);
}

function MyApplet(orientation, panel_height, instance_id) {
    this._init(orientation, panel_height, instance_id);
}

MyApplet.prototype = {
    __proto__: Applet.IconApplet.prototype,

    _init: function(orientation, panel_height, instance_id) {
        Applet.IconApplet.prototype._init.call(this, orientation, panel_height, instance_id);

        try {
            this.set_applet_icon_name("input-touchpad");
            this.set_applet_tooltip(_("Touchpad Control"));

            // 터치패드 ID 찾기
            this.touchpadId = this._findTouchpadId();
            
            // 터치패드가 없는 경우 처리
            if (this.touchpadId === null) {
                this.set_applet_icon_name("touchpad-disabled-symbolic");
                this.set_applet_tooltip(_("No touchpad found"));
                this.touchpadEnabled = false;
            } else {
                this.touchpadEnabled = this._isTouchpadEnabled();
            }
            
            this.menuManager = new PopupMenu.PopupMenuManager(this);
            this.menu = new Applet.AppletPopupMenu(this, orientation);
            this.menuManager.addMenu(this.menu);

            // 터치패드 켜기
            this.menu.addAction(_("Touchpad On"), Lang.bind(this, function() {
                if (this.touchpadId !== null) {
                    GLib.spawn_command_line_async("xinput enable " + this.touchpadId);
                    this._updateIcon(true);
                }
            }));

            // 터치패드 끄기
            this.menu.addAction(_("Touchpad Off"), Lang.bind(this, function() {
                if (this.touchpadId !== null) {
                    GLib.spawn_command_line_async("xinput disable " + this.touchpadId);
                    this._updateIcon(false);
                }
            }));

            // 구분선 추가
            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

            // 상태 텍스트
            this.statusItem = new PopupMenu.PopupMenuItem("", { reactive: false });
            this.menu.addMenuItem(this.statusItem);
            this._updateStatusText();

            // 터치패드가 없는 경우 메뉴 아이템 비활성화
            if (this.touchpadId === null) {
                this.menu._getMenuItems().forEach(function(item) {
                    if (item instanceof PopupMenu.PopupMenuItem || item instanceof PopupMenu.PopupSwitchMenuItem) {
                        item.actor.reactive = false;
                        item.actor.add_style_class_name('inactive');
                    }
                });
            }
        } catch (e) {
            global.logError(e);
        }
    },

    _findTouchpadId: function() {
        try {
            let [success, output] = GLib.spawn_command_line_sync("xinput list");
            if (success) {
                let lines = output.toString().split("\n");
                for (let line of lines) {
                    if (line.toLowerCase().includes("touchpad")) {
                        let match = line.match(/id=(\d+)/);
                        if (match) {
                            return match[1];
                        }
                    }
                }
            }
        } catch (e) {
            global.logError("Error finding touchpad: " + e);
        }
        return null;
    },

    _isTouchpadEnabled: function() {
        if (this.touchpadId === null) return true;
        try {
            let [success, output] = GLib.spawn_command_line_sync("xinput list-props " + this.touchpadId);
            if (success) {
                let lines = output.toString().split("\n");
                for (let line of lines) {
                    if (line.includes("Device Enabled")) {
                        return line.includes("1");
                    }
                }
            }
        } catch (e) {
            global.logError("Error checking touchpad state: " + e);
        }
        return true;
    },

    _updateStatusText: function() {
        if (this.touchpadId === null) {
            this.statusItem.label.set_text(_("No touchpad found"));
        } else if (this.touchpadEnabled) {
            this.statusItem.label.set_text(_("Touchpad is enabled"));
        } else {
            this.statusItem.label.set_text(_("Touchpad is disabled"));
        }
    },

    _updateIcon: function(enabled) {
        if (enabled !== undefined) {
            this.touchpadEnabled = enabled;
        }
        if (this.touchpadEnabled) {
            this.set_applet_icon_name("input-touchpad");
        } else {
            this.set_applet_icon_name("touchpad-disabled-symbolic");
        }
        this._updateStatusText();
    },

    on_applet_clicked: function(event) {
        this.menu.toggle();
    },

    on_applet_removed_from_panel: function() {
        this.menuManager.removeMenu(this.menu);
    }
};

function main(metadata, orientation, panel_height, instance_id) {
    let myApplet = new MyApplet(orientation, panel_height, instance_id);
    return myApplet;
}