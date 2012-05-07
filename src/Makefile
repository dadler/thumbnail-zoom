##
# Copyright (c) 2010 Andres Hernandez Monge
# All rights reserved.
#
# Redistribution and use in source and binary forms, with or without
# modification, are permitted provided that the following conditions
# are met:
# 1. Redistributions of source code must retain the above copyright
#    notice, this list of conditions and the following disclaimer.
# 2. Redistributions in binary form must reproduce the above copyright
#    notice, this list of conditions and the following disclaimer in the
#    documentation and/or other materials provided with the distribution.
# 3. Neither the name of copyright holders nor the names of its
#    contributors may be used to endorse or promote products derived
#    from this software without specific prior written permission.
#
# THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
# "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED
# TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR
# PURPOSE ARE DISCLAIMED.  IN NO EVENT SHALL COPYRIGHT HOLDERS OR CONTRIBUTORS
# BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
# CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
# SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
# INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
# CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
# ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
# POSSIBILITY OF SUCH DAMAGE.
##

# The name of the extension.
extension_name := thumbnailzoomplus

# The UUID of the extension.
extension_uuid := E10A6337-382E-4FE6-96DE-936ADC34DD04

# The name of the profile dir where the extension can be installed.
profile_dir := snsyv95n.default

# The zip application to be used.
ZIP := zip

# The target location of the build and build files.
bin_dir := ../bin

# The target XPI files.
xpi_file :=      $(bin_dir)/$(extension_name).xpi
xpi_file_date := $(bin_dir)/$(extension_name)-$$(date "+%Y%m%d").xpi
xpi_file_uuid := $(bin_dir)/{$(extension_uuid)}.xpi

# The type of operating system this make command is running on.
os_type := $(patsubst darwin%,darwin,$(shell echo $(OSTYPE)))

# The location of the extension profile.
profile_location := \
  ~/Library/Application\ Support/Firefox/Profiles/$(profile_dir)/extensions/

# The temporary location where the extension tree will be copied and built.
build_dir := $(bin_dir)/build

# The install.rdf file.
install_rdf := install.rdf

# The chrome.manifest file.
chrome_manifest := chrome.manifest

# The chrome dir.
chrome_dir := chrome

# The resources dir.
resources_dir := resources

# The defaults dir.
defaults_dir := defaults

# The preferences dir.
preferences_dir := $(defaults_dir)/preferences

# This builds the extension XPI file.
.PHONY: all
all: $(xpi_file)
	@echo
	@echo "Build finished successfully."
	@echo

# This cleans all temporary files and directories created by 'make'.
.PHONY: clean
clean:
	@rm -rf $(build_dir)
	@rm -f $(xpi_file)
	@rm -f $(xpi_file_date)
	@rm -f $(xpi_file_uuid)
	@echo "Cleanup is done."

# The includes are added after the targets because we want this file to contain
# the default (first) target.
include chrome/Makefile.in
include resources/Makefile.in

# The sources for the XPI file. Uses variables defined in the included
# Makefiles.
xpi_built := $(build_dir)/$(install_rdf) \
             $(build_dir)/$(chrome_manifest) \
             $(addprefix $(build_dir)/,$(chrome_sources)) \
             $(addprefix $(build_dir)/,$(resources_sources)) \
             $(build_dir)/$(preferences_dir)/thumbnailzoomplus.js \

xpi_built_no_dir := $(subst $(build_dir)/,,$(xpi_built))

# This builds everything except for the actual XPI, and then it copies it to the
# specified profile directory, allowing a quick update that requires no install.
.PHONY: install3
install3: $(build_dir) $(xpi_built)
	@echo "Installing in profile folder on Fx3: $(profile_location)\{$(extension_uuid)\}"
	@cp -Rf $(build_dir)/* $(profile_location)\{$(extension_uuid)\}
	@echo "Installing in profile folder. Done!"
	@echo

.PHONY: install4
install4: $(build_dir) $(xpi_built)
	@echo "Installing in profile folder of Fx4: $(profile_location)"
	@cp -Rf $(xpi_file_uuid) $(profile_location)
	@echo "Installing in profile folder. Done!"
	@echo

$(xpi_file): $(build_dir) $(xpi_built)
	@echo "Creating XPI files."
	@cd $(build_dir); $(ZIP) ../$(xpi_file) $(xpi_built_no_dir)
	# @cp -f $(xpi_file) $(xpi_file_date)
	# @cp -f $(xpi_file) $(xpi_file_uuid)
	@echo "Created XPI file $(xpi_file)"

$(build_dir)/$(chrome_dir)/%: $(chrome_dir)/% $(build_dir)/$(chrome_dir)
	@if [ ! -x $(dir $@) ]; \
  then \
    mkdir -p $(dir $@); \
  fi
	@cp -f $< $@

$(build_dir)/$(resources_dir)/%: $(resources_dir)/% $(build_dir)/$(resources_dir)
	@if [ ! -x $(dir $@) ]; \
  then \
    mkdir -p $(dir $@); \
  fi
	@cp -f $< $@

$(build_dir)/$(defaults_dir)/%: $(defaults_dir)/% $(build_dir)/$(defaults_dir)
	@if [ ! -x $(dir $@) ]; \
  then \
    mkdir -p $(dir $@); \
  fi
	@cp -f $< $@

$(build_dir)/$(preferences_dir)/%: $(preferences_dir)/% $(build_dir)/$(preferences_dir)
	@cp -f $< $@

$(build_dir)/%: %
	@cp -f $< $@

$(build_dir):
	@if [ ! -x $(build_dir) ]; \
  then \
    mkdir -p $(build_dir); \
  fi

$(build_dir)/$(chrome_dir):
	@if [ ! -x $(build_dir)/$(chrome_dir) ]; \
  then \
    mkdir -p $(build_dir)/$(chrome_dir); \
  fi

$(build_dir)/$(resources_dir):
	@if [ ! -x $(build_dir)/$(resources_dir) ]; \
  then \
    mkdir -p $(build_dir)/$(resources_dir); \
  fi

$(build_dir)/$(defaults_dir):
	@if [ ! -x $(build_dir)/$(defaults_dir) ]; \
  then \
    mkdir -p $(build_dir)/$(defaults_dir); \
  fi

$(build_dir)/$(preferences_dir):
	@if [ ! -x $(build_dir)/$(preferences_dir) ]; \
  then \
    mkdir -p $(build_dir)/$(preferences_dir); \
  fi
