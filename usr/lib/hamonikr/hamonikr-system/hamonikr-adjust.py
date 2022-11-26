#!/usr/bin/python3

import os
import sys
import time
import datetime
import fileinput
import filecmp
import configparser
import glob

TIMESTAMPS = "/var/log/hamonikr-system.timestamps"


class HamoniKRSystem():

    def __init__(self):
        self.start_time = datetime.datetime.now()
        self.logfile = open("/var/log/hamonikr-system.log", "a")
        self.time_log("hamonikr system started")
        self.executed = []
        self.executed_once = []
        self.overwritten = []
        self.skipped = []
        self.edited = []
        self.minimized = []
        self.original_timestamps = {}
        self.timestamps = {}
        self.timestamps_changed = False
        self.read_timestamps()

    def time_log(self, string):
        self.log("%s - %s" % (time.strftime("%Y-%m-%d %H:%M:%S"), string))

    def log(self, string):
        self.logfile.writelines("%s\n" % string)

    def quit(self):
        stop_time = datetime.datetime.now()
        self.log("Execution time: %s" % (stop_time - self.start_time))
        self.logfile.flush()
        self.logfile.close()
        sys.exit(0)

    def read_timestamps(self):
        if os.path.exists(TIMESTAMPS):
            filehandle = open(TIMESTAMPS)
            for line in filehandle:
                line = line.strip()
                line_items = line.split()
                if len(line_items) == 2:
                    self.original_timestamps[line_items[0]] = line_items[1]
                    self.timestamps[line_items[0]] = line_items[1]

    def write_timestamps(self):
        filehandle = open(TIMESTAMPS, "w")
        for filename in sorted(self.timestamps.keys()):
            line = "%s %s\n" % (filename, self.timestamps[filename])
            filehandle.write(line)
        filehandle.close()

    def has_changed(self, filename, collection, description):
        if not os.path.exists(filename):
            return False

        timestamp = os.stat(filename).st_mtime
        if (filename not in self.original_timestamps):
            has_changed = True
        else:
            has_changed = (self.original_timestamps[filename] != str(timestamp))

        if (has_changed):
            collection.append("%s (%s)" % (filename, description))
        else:
            self.skipped.append("%s (%s)" % (filename, description))
        return has_changed

    def update_timestamp(self, filename):
        timestamp = os.stat(filename).st_mtime
        self.timestamps[filename] = timestamp
        self.timestamps_changed = True

    def replace_file(self, source, destination):
        if os.path.exists(source) and os.path.exists(destination):
            if (destination not in self.overwritten) and (destination not in self.skipped):
                if filecmp.cmp(source, destination):
                    self.skipped.append(destination)
                else:
                    self.overwritten.append(destination)
                    os.system("cp " + source + " " + destination)

    def adjust(self):
        try:
            # Read configuration
            try:
                config = configparser.RawConfigParser()
                config.read('/etc/hamonikr/hamonikrSystem.conf')
                self.enabled = (config.get('global', 'enabled') == "True")
                self.minimal = (config.get('global', 'minimal') == "True")
            except:
                config = configparser.RawConfigParser()
                config.add_section('global')
                config.set('global', 'enabled', 'True')
                config.set('global', 'minimal', 'False')
                config.add_section('restore')
                with open('/etc/hamonikr/hamonikrSystem.conf', 'w') as configfile:
                    config.write(configfile)
                self.enabled = True
                self.minimal = False

            # Exit if disabled
            if not self.enabled:
                self.log("Disabled - Exited")
                self.quit()

            # Run if minimal mode True
            if self.minimal:
                self.log("Adjust Minimal Mode - ACTIVE")
                os.system("mv /etc/xdg/autostart/hamonikr-minimal.desktop.disable /etc/xdg/autostart/hamonikr-minimal.desktop")
                filehandle = open("/usr/share/hamonikr/hamonikr-min/killapps")
                for line in filehandle:
                    line = line.strip()
                    if not line.find("#") != -1:
                        if os.path.exists("/etc/xdg/autostart/%s" % (line)):
                            os.system("mv /etc/xdg/autostart/%s /etc/xdg/autostart/%s" % (line, line + ".norun"))
                            self.minimized.append(line)
                filehandle.close()
            else:
                self.log("Restore Minimal Mode - INACTIVE")
                os.system("mv /etc/xdg/autostart/hamonikr-minimal.desktop /etc/xdg/autostart/hamonikr-minimal.desktop.disable")
                filehandle = open("/usr/share/hamonikr/hamonikr-min/killapps")
                for filename in os.listdir("/etc/xdg/autostart"):
                    basename, extension = os.path.splitext(filename)
                    if extension == ".norun":
                        os.system("mv /etc/xdg/autostart/%s /etc/xdg/autostart/%s" % (filename, basename))
                filehandle.close()

            adjustment_directory = "/etc/hamonikr/adjustments/"

            # Perform file execution adjustments
            for filename in os.listdir(adjustment_directory):
                basename, extension = os.path.splitext(filename)
                if extension == ".execute":
                    full_path = os.path.join(adjustment_directory, filename)
                    os.system(full_path)
                    self.executed.append(full_path)

            # For a script that runs once and does not repeat 
            for filename in os.listdir(adjustment_directory):
                basename, extension = os.path.splitext(filename)
                if extension == ".execute-once":
                    full_path = os.path.join(adjustment_directory, filename)
                    os.system(full_path)
                    os.system("mv -f " + full_path + " " + adjustment_directory + basename + ".execute-done" )
                    self.executed_once.append(full_path)

            # Perform file overwriting adjustments
            array_preserves = []
            if os.path.exists(adjustment_directory):
                for filename in os.listdir(adjustment_directory):
                    basename, extension = os.path.splitext(filename)
                    if extension == ".preserve":
                        filehandle = open(os.path.join(adjustment_directory, filename))
                        for line in filehandle:
                            line = line.strip()
                            if (line):
                                array_preserves.append(line)
                        filehandle.close()

            overwrites = {}
            if os.path.exists(adjustment_directory):
                for filename in sorted(os.listdir(adjustment_directory)):
                    basename, extension = os.path.splitext(filename)
                    if extension == ".overwrite":
                        filehandle = open(os.path.join(adjustment_directory, filename))
                        for line in filehandle:
                            line = line.strip()
                            line_items = line.split()
                            if len(line_items) == 2:
                                source, destination = line.split()
                                if destination not in array_preserves:
                                    overwrites[destination] = source
                        filehandle.close()

            for key in overwrites.keys():
                source = overwrites[key]
                destination = key
                if os.path.exists(source):
                    if "*" not in destination:
                        self.replace_file(source, destination)
                    else:
                        # Wildcard destination, find all possible matching destinations
                        for matching_destination in glob.glob(destination):
                            self.replace_file(source, matching_destination)

            # Perform menu adjustments
            for filename in os.listdir(adjustment_directory):
                basename, extension = os.path.splitext(filename)
                if extension == ".menu":
                    filehandle = open(os.path.join(adjustment_directory, filename))
                    for line in filehandle:
                        line = line.strip()
                        line_items = line.split()
                        if len(line_items) > 0:
                            if line_items[0] == "hide":
                                if len(line_items) == 2:
                                    action, desktop_file = line.split()
                                    if self.has_changed(desktop_file, self.edited, "hide"):
                                        os.system("grep -q -F 'NoDisplay=true' %s || echo '\nNoDisplay=true' >> %s" % (desktop_file, desktop_file))
                                        self.update_timestamp(desktop_file)
                            elif line_items[0] == "show":
                                if len(line_items) == 2:
                                    action, desktop_file = line.split()
                                    if self.has_changed(desktop_file, self.edited, "show"):
                                        os.system("sed -i -e '/^NoDisplay/d' \"%s\"" % desktop_file)
                                        self.update_timestamp(desktop_file)
                            elif line_items[0] == "categories":
                                if len(line_items) == 3:
                                    action, desktop_file, categories = line.split()
                                    if self.has_changed(desktop_file, self.edited, "categories"):
                                        categories = categories.strip()
                                        os.system("sed -i -e 's/Categories=.*/Categories=%s/g' %s" % (categories, desktop_file))
                                        self.update_timestamp(desktop_file)
                            elif line_items[0] == "onlyshowin":
                                if len(line_items) == 3:
                                    action, desktop_file, onlyshowins = line.split()
                                    if self.has_changed(desktop_file, self.edited, "onlyshowin"):
                                        onlyshowins = onlyshowins.strip()
                                        os.system("sed -i -e 's/OnlyShowIn=.*/OnlyShowIn=%s/g' %s" % (onlyshowins, desktop_file))
                                        self.update_timestamp(desktop_file)
                            elif line_items[0] == "exec":
                                if len(line_items) >= 3:
                                    action, desktop_file, executable = line.split(' ', 2)
                                    if self.has_changed(desktop_file, self.edited, "exec"):
                                        executable = executable.strip()
                                        found_exec = False
                                        for desktop_line in fileinput.input(desktop_file, inplace=True):
                                            if desktop_line.startswith("Exec=") and not found_exec:
                                                found_exec = True
                                                desktop_line = "Exec=%s" % executable
                                            print (desktop_line.strip())
                                        self.update_timestamp(desktop_file)
                            elif line_items[0] == "rename":
                                if len(line_items) == 3:
                                    action, desktop_file, names_file = line.split()
                                    names_file = names_file.strip()
                                    if os.path.exists(names_file) and os.path.exists(desktop_file) and (self.has_changed(desktop_file, self.edited, "name") or self.has_changed(names_file, self.edited, "name")):
                                        # remove all existing names, generic names, comments
                                        os.system("sed -i -e '/^Name/d' -e '/^GenericName/d' -e '/^Comment/d' \"%s\"" % desktop_file)
                                        # add provided ones
                                        os.system("cat \"%s\" >> \"%s\"" % (names_file, desktop_file))
                                        self.update_timestamp(desktop_file)
                                        self.update_timestamp(names_file)
                            elif line_items[0] == "renameko":
                                if len(line_items) == 3:
                                    action, desktop_file, names_file = line.split()
                                    names_file = names_file.strip()
                                    if os.path.exists(names_file) and os.path.exists(desktop_file) and (self.has_changed(desktop_file, self.edited, "name") or self.has_changed(names_file, self.edited, "name")):
                                        # remove all existing names, generic names, comments
                                        os.system("sed -i -e '/^Name[ko]/d' -e '/^GenericName[ko]/d' -e '/^Comment[ko]/d' \"%s\"" % desktop_file)
                                        # add provided ones
                                        os.system("cat \"%s\" >> \"%s\"" % (names_file, desktop_file))
                                        self.update_timestamp(desktop_file)
                                        self.update_timestamp(names_file)                                        
                    filehandle.close()

            self.log("Executed:")
            for filename in sorted(self.executed):
                self.log("  %s" % filename)

            self.log("Executed Once:")
            for filename in sorted(self.executed_once):
                self.log("  %s" % filename)

            self.log("Replaced:")
            for filename in sorted(self.overwritten):
                self.log("  %s" % filename)

            self.log("Edited:")
            for filename in sorted(self.edited):
                self.log("  %s" % filename)

            self.log("Skipped:")
            for filename in sorted(self.skipped):
                self.log("  %s" % filename)
            
            self.log("Minimized:")
            for filename in sorted(self.minimized):
                self.log("  %s" % filename)    
            
            self.log("--------------------")

            if self.timestamps_changed:
                self.write_timestamps()

        except Exception as detail:
            print (detail)
            self.log(detail)

hamonikrsystem = HamoniKRSystem()
hamonikrsystem.adjust()
hamonikrsystem.quit()