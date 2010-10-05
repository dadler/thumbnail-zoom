/**
 * Copyright (c) 2010 Andres Hernandez Monge
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions
 * are met:
 * 1. Redistributions of source code must retain the above copyright
 *    notice, this list of conditions and the following disclaimer.
 * 2. Redistributions in binary form must reproduce the above copyright
 *    notice, this list of conditions and the following disclaimer in the
 *    documentation and/or other materials provided with the distribution.
 * 3. Neither the name of copyright holders nor the names of its
 *    contributors may be used to endorse or promote products derived
 *    from this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
 * "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED
 * TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR
 * PURPOSE ARE DISCLAIMED.  IN NO EVENT SHALL COPYRIGHT HOLDERS OR CONTRIBUTORS
 * BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
 * CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
 * SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
 * INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
 * CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
 * ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
 * POSSIBILITY OF SUCH DAMAGE.
 */

Cu.import("resource://imagezoom/common.js");
Cu.import("resource://imagezoom/filterService.js");
Cu.import("resource://imagezoom/uninstallService.js");

/**
 * Controls the browser overlay.
 */
ImageZoomChrome.Overlay = {
  /* UI preference keys. */
  PREF_PANEL_DELAY : ImageZoom.PrefBranch + "panel.delay",
  PREF_STATUSBAR_SHOW : ImageZoom.PrefBranch + "statusbar.show",

  /* Logger for this object. */
  _logger : null,
  /* Preferences service. */
  _preferencesService : null,

  /* The timer. */
  _timer : null,
  /* The floating panel. */
  _panel : null,
  /* The floating panel image. */
  _panelImage : null,

  /**
   * Initializes the object.
   */
  init : function() {
    this._logger = ImageZoom.getLogger("ImageZoomChrome.Overlay");
    this._logger.debug("init");

    this._preferencesService =
      Cc["@mozilla.org/preferences-service;1"].getService(Ci.nsIPrefBranch2);
    this._timer = Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer);
    this._panel = document.getElementById("imagezoom-panel");
    this._panelImage = document.getElementById("imagezoom-panel-image");

    this._preferencesService.addObserver(this.PREF_STATUSBAR_SHOW, this, false);
    this._addPreferenceObservers(true);
    this._showStatusBarButton();
    this._updatePreferencesUI();
    this._addEventListeners();
  },

  /**
   * Uninitializes the object.
   */
  uninit : function() {
    this._logger.debug("uninit");

    this._panel = null;
    this._panelImage = null;
    this._preferencesService.removeObserver(this.PREF_STATUSBAR_SHOW, this);
    this._addPreferenceObservers(false);
  },

  /**
   * Adds the preference observers.
   * @param aValue true if adding, false when removing.
   */
  _addPreferenceObservers : function(aValue) {
    this._logger.debug("_addPreferenceObservers");

    let pageCount = ImageZoom.FilterService.PAGE_INFO.length;
    let preference = null;
    let pageInfo = null;

    for (let i = 0; i < pageCount; i++) {
      pageInfo = ImageZoom.FilterService.PAGE_INFO[i];
      preference = ImageZoom.PrefBranch + pageInfo.key + ".enable";

      if (aValue) {
        this._preferencesService.addObserver(preference, this, false);
      } else {
        this._preferencesService.removeObserver(preference, this);
      }
    }
  },

  /**
   * Updates the UI that depends on preferences.
   */
  _updatePreferencesUI : function() {
    this._logger.trace("_updatePreferencesUI");

    let pageCount = ImageZoom.FilterService.PAGE_INFO.length;

    for (let i = 0; i < pageCount; i++) {
      this._updateStatusbarMenu(i);
    }
  },

  /**
   * Adds the event listeners.
   */
  _addEventListeners : function() {
    this._logger.trace("_addEventListeners");

    let that = this;

    gBrowser.addEventListener(
      "DOMContentLoaded",
      function(aEvent) { that._handlePageLoaded(aEvent); }, true);
    gBrowser.tabContainer.addEventListener(
      "TabSelect",
      function(aEvent) { that._handleTabSelected(aEvent); }, false);
  },

  /**
   * Handles the TabSelect event.
   * @param aEvent the event object.
   */
  _handleTabSelected : function(aEvent) {
    this._logger.trace("_handlePageLoaded");

    this._closePanel();
  },

  /**
   * Handles the DOMContentLoaded event.
   * @param aEvent the event object.
   */
  _handlePageLoaded : function(aEvent) {
    this._logger.trace("_handlePageLoaded");

    let that = this;
    let doc = aEvent.originalTarget;

    if (doc instanceof HTMLDocument) {
      let pageConstant = ImageZoom.FilterService.getPageConstantByDoc(doc);

      if (-1 != pageConstant) {
        doc.addEventListener(
          "mouseover",
          function(aEvent) {
            that._handleMouseOver(aEvent, pageConstant);
          }, true);
      } else {
        this._closePanel();
      }
    } else {
      this._closePanel();
    }
  },

  /**
   * Handles the mouse over event.
   * @param aEvent the event object.
   * @param aPage the filtered page.
   */
  _handleMouseOver : function(aEvent, aPage) {
    this._logger.trace("_handleMouseOver");

    let imageNode = aEvent.target;
    let imageSrc = ImageZoom.FilterService.getImageSource(imageNode, aPage);

    if (null != imageSrc) {
      if (ImageZoom.FilterService.isPageEnabled(aPage) &&
          ImageZoom.FilterService.filterImage(imageSrc, aPage)) {
        let that = this;

        this._timer.cancel();
        this._timer.initWithCallback({ notify:
          function() { that._showZoomedImage(imageSrc, imageNode, aPage); }
        }, this._getHoverTime(), Ci.nsITimer.TYPE_ONE_SHOT);
      } else {
        this._closePanel();
      }
    } else {
      this._closePanel();
    }
  },

  /**
   * Closes the panel.
   */
  _closePanel : function() {
    this._logger.trace("_closePanel");

    this._timer.cancel();
    if (this._panel.state != "closed") {
      this._panel.hidePopup();
    }
  },

  /**
   * Shows the panel.
   * @param aImageNode the image node.
   * @param aImageSrc the image source.
   */
  _showPanel : function(aImageNode, aImageSrc) {
    this._logger.trace("_showPanel");

    // reset previous pic.
    this._panelImage.removeAttribute("src");
    this._panelImage.style.maxWidth = "";
    this._panelImage.style.minWidth = "";
    this._panelImage.style.maxHeight = "";
    this._panelImage.style.minHeight = "";
    this._closePanel();

    // open new pic.
    if (this._panel.state != "open") {
      this._panel.openPopup(aImageNode, "end_before", 30, 30, false, false);
    }
    this._panelImage.src = aImageSrc;
  },

  /**
   * Shows the zoomed image panel.
   * @param aImageSrc the image source
   * @param aImageNode the image node
   * @param aPage the page constant
   */
  _showZoomedImage : function(aImageSrc, aImageNode, aPage) {
    this._logger.trace("_showZoomedImage");

    let zoomImageSrc = ImageZoom.FilterService.getZoomImage(aImageSrc, aPage);

    if (null != zoomImageSrc) {
      this._showPanel(aImageNode, zoomImageSrc);
    } else {
      this._closePanel();
    }
  },

  /**
   * Gets the hover time.
   * @return the hover time, 0 by default.
   */
  _getHoverTime : function() {
    this._logger.trace("_getHoverTime");

    let delayPreference =
      ImageZoom.Application.prefs.get(this.PREF_PANEL_DELAY);
    let hoverTime = 0;

    if (delayPreference && 1 == delayPreference.value) {
      hoverTime = 2000;
    }

    return hoverTime;
  },

  /**
   * Scales the image to fit the window.
   */
  scaleImage : function() {
    this._logger.debug("scaleImage");

    let pageWidth = content.document.documentElement.clientWidth;
    let pageHeight = content.document.documentElement.clientHeight;
    let imageWidth =
      parseInt(window.getComputedStyle(this._panelImage, null).
        getPropertyValue("width").replace("px", ""));
    let imageHeight =
      parseInt(window.getComputedStyle(this._panelImage, null).
        getPropertyValue("height").replace("px", ""));
    let scaleWidth = imageWidth;
    let scaleHeight = imageHeight;

    if (imageHeight > pageHeight) {
      scaleHeight = pageHeight;
      scaleWidth = parseInt(imageWidth * pageHeight / imageHeight);
    } else if (imageWidth > pageWidth) {
      scaleWidth = pageWidth;
      scaleHeight = parseInt(imageHeight * pageWidth / imageWidth);
    }

    this._panelImage.style.maxWidth = scaleWidth + "px";
    this._panelImage.style.minWidth = scaleWidth + "px";
    this._panelImage.style.maxHeight = scaleHeight + "px";
    this._panelImage.style.minHeight = scaleHeight + "px";
  },

  /**
   * Opens the preferences window.
   */
  openPreferences : function() {
    this._logger.debug("openPreferences");

    let optionsDialog =
      window.openDialog("chrome://imagezoom/content/options.xul",
        "imagezoom-options-window", "chrome,centerscreen");

    optionsDialog.focus();
  },

  /**
   * Toggles the preference value.
   * @param aPage the page constant.
   */
  togglePreference : function(aPage) {
    this._logger.debug("togglePreference");

    ImageZoom.FilterService.togglePageEnable(aPage);
  },

  /**
   * Updates the statusbar menu.
   * @param aPage the page constant.
   */
  _updateStatusbarMenu : function(aPage) {
    this._logger.trace("_updateStatusbarMenu");

    let pageName = ImageZoom.FilterService.getPageName(aPage);
    let pageEnable = ImageZoom.FilterService.isPageEnabled(aPage);
    let menuItemId = "imagezoom-status-menuitem-" + pageName;
    let menuItem = document.getElementById(menuItemId);

    if (null != menuItem) {
      menuItem.setAttribute("checked", pageEnable);
    }
  },

  /**
   * Shows/hides the statusbar button.
   */
  _showStatusBarButton : function() {
    this._logger.trace("_showStatusBarButton");

    let statusbarButton = document.getElementById("imagezoom-statusbar-panel");
    let statusbarPrefValue =
      ImageZoom.Application.prefs.get(this.PREF_STATUSBAR_SHOW).value;

    statusbarButton.hidden = !statusbarPrefValue;
  },

  /**
   * Observes the authentication topic.
   * @param aSubject The object related to the change.
   * @param aTopic The topic being observed.
   * @param aData The data related to the change.
   */
  observe : function(aSubject, aTopic, aData) {
    this._logger.debug("observe");

    if ("nsPref:changed" == aTopic) {
      if (this.PREF_STATUSBAR_SHOW == aData) {
        this._showStatusBarButton();
      } else if (-1 != aData.indexOf(ImageZoom.PrefBranch) &&
                 -1 != aData.indexOf(".enable")) {
        let page =
          aData.replace(ImageZoom.PrefBranch, "").replace(".enable", "");
        let pageConstant = ImageZoom.FilterService.getPageConstantByName(page);

        if (-1 != pageConstant) {
          this._updateStatusbarMenu(pageConstant);
        }
      }
    }
  }
};

window.addEventListener(
  "load", function() { ImageZoomChrome.Overlay.init(); }, false);
window.addEventListener(
  "unload", function() { ImageZoomChrome.Overlay.uninit(); }, false);
