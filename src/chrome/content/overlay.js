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
Cu.import("resource://imagezoom/pages.js");
Cu.import("resource://imagezoom/filterService.js");
Cu.import("resource://imagezoom/downloadService.js");
Cu.import("resource://imagezoom/uninstallService.js");

/**
 * Controls the browser overlay.
 */
ImageZoomChrome.Overlay = {
  /* UI preference keys. */
  PREF_PANEL_KEY : ImageZoom.PrefBranch + "panel.key",
  PREF_PANEL_WAIT : ImageZoom.PrefBranch + "panel.wait",
  PREF_PANEL_DELAY : ImageZoom.PrefBranch + "panel.delay",
  PREF_PANEL_BORDER : ImageZoom.PrefBranch + "panel.border",
  PREF_PANEL_LARGE_IMAGE : ImageZoom.PrefBranch + "panel.largeimage",
  PREF_PANEL_OPACITY : ImageZoom.PrefBranch + "panel.opacity",
  /* Toolbar button preference key. */
  PREF_TOOLBAR_INSTALLED : ImageZoom.PrefBranch + "button.installed",

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
  /* The floating panel throbber */
  _panelThrobber : null,
  /* The current image source. */
  _currentImage : null,
  /* Context download image menu item */
  _contextMenu : null,
  /* File Picker. */
  _filePicker : null,
  /* _thumbBBox is the bounding box of the thumbnail or link which caused
     the popup to launch, in screen coordinates. */
  _thumbBBox : { xMin: -999, xMax: -999, yMin: -999, yMax: 999},
  
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
    this._panelThrobber = document.getElementById("imagezoom-panel-throbber");
    this._contextMenu = document.getElementById("imagezoom-context-download");

    this._filePicker =
      Cc["@mozilla.org/filepicker;1"].createInstance(Ci.nsIFilePicker);
    this._filePicker.init(window, null, Ci.nsIFilePicker.modeSave);

    this._updatePreferenceFix();
    this._installToolbarButton();
    this._showPanelBorder();
    this._preferencesService.addObserver(this.PREF_PANEL_BORDER, this, false);
    this._preferencesService.addObserver(this.PREF_PANEL_OPACITY, this, false);
    this._addPreferenceObservers(true);
    this._addEventListeners();
  },

  /**
   * Uninitializes the object.
   */
  uninit : function() {
    this._logger.debug("uninit");

    this._panel = null;
    this._panelImage = null;
    this._panelThrobber = null;
    this._currentImage = null;
    this._contextMenu = null;
    this._preferencesService.removeObserver(this.PREF_PANEL_BORDER, this);
    this._preferencesService.removeObserver(this.PREF_PANEL_OPACITY, this);
    this._addPreferenceObservers(false);
  },

  /**
   * Updates preference fix.
   */
  _updatePreferenceFix : function() {
    this._logger.trace("_updatePreferenceFix");

    let delayPref = ImageZoom.Application.prefs.get(this.PREF_PANEL_DELAY);
    if (delayPref) {
      let preferenceService =
        Cc["@mozilla.org/preferences-service;1"].getService(Ci.nsIPrefBranch);
      let delayValue = String(delayPref.value);

      ImageZoom.Application.prefs.setValue(this.PREF_PANEL_WAIT, delayValue);
      preferenceService.clearUserPref(this.PREF_PANEL_DELAY);
    }
  },

  /**
   * Installs the toolbar button on the first run.
   */
  _installToolbarButton : function() {
    this._logger.trace("_installToolbarButton");

    let buttonInstalled =
      ImageZoom.Application.prefs.get(this.PREF_TOOLBAR_INSTALLED).value;

    if (!buttonInstalled) {
      let toolbarId =
        (null == document.getElementById("addon-bar") ? "nav-bar": "addon-bar");
      let toolbar = document.getElementById(toolbarId);
      let newCurrentSet = null;

      if (-1 != toolbar.currentSet.indexOf("urlbar-container")) {
         newCurrentSet = toolbar.currentSet.replace(
           /urlbar-container/, "imagezoom-toolbar-button,urlbar-container");
      } else {
         newCurrentSet = toolbar.currentSet + ",imagezoom-toolbar-button";
      }
      toolbar.setAttribute("currentset", newCurrentSet);
      toolbar.currentSet = newCurrentSet;
      document.persist(toolbarId, "currentset");

      try {
        BrowserToolboxCustomizeDone(true);
      } catch (e) { }

      ImageZoom.Application.prefs.setValue(this.PREF_TOOLBAR_INSTALLED, true);
    }
  },

  /**
   * Adds the preference observers.
   * @param aValue true if adding, false when removing.
   */
  _addPreferenceObservers : function(aValue) {
    this._logger.debug("_addPreferenceObservers");

    let pageCount = ImageZoom.FilterService.pageList.length;
    let preference = null;
    let pageInfo = null;

    for (let i = 0; i < pageCount; i++) {
      pageInfo = ImageZoom.FilterService.pageList[i];
      preference = ImageZoom.PrefBranch + pageInfo.key + ".enable";

      if (aValue) {
        this._preferencesService.addObserver(preference, this, false);
      } else {
        this._preferencesService.removeObserver(preference, this);
      }
    }
  },

  /**
   * Adds the menu items.
   */
  addMenuItems : function() {
    this._logger.debug("addMenuItems");

    let menuPopup = document.getElementById("imagezoom-toolbar-menu");

    if (menuPopup) {
      let menuSeparator =
        document.getElementById("imagezoom-toolbar-menuseparator");
      let menuItem = null;
      let pageCount = ImageZoom.FilterService.pageList.length;
      let pageInfo = null;

      for (let i = 0; i < pageCount; i++) {
        pageInfo = ImageZoom.FilterService.pageList[i];
        menuItem = document.createElement("menuitem");
        menuItem.setAttribute(
          "id", "imagezoom-toolbar-menuitem-" + pageInfo.key);
        menuItem.setAttribute("label", pageInfo.name);
        menuItem.setAttribute("type", "checkbox");
        { 
          let aPage = i;
          menuItem.addEventListener("command",
              function() { ImageZoomChrome.Overlay.togglePreference(aPage);},
              true );
        }
        menuPopup.insertBefore(menuItem, menuSeparator);
        this._updatePagesMenu(i);
      }
    }
  },

  /**
   * Removes the menu items.
   */
  removeMenuItems : function() {
    this._logger.debug("removeMenuItems");

    let menuPopup = document.getElementById("imagezoom-toolbar-menu");

    if (menuPopup) {
      let menuSeparator =
        document.getElementById("imagezoom-toolbar-menuseparator");

      while (menuPopup.firstChild != menuSeparator) {
        menuPopup.removeChild(menuPopup.firstChild);
      }
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
    
    this._panel.addEventListener(
      "click",
      function(aEvent) {
        that._handlePopupClick(aEvent);
      }, false);
    this._panel.addEventListener(
      "mousemove",
      function(aEvent) {
        that._handlePopupMove(aEvent);
      }, true);
  },

  /**
   * Adds listeners when the popup image is shown.  The listener is added
   * on the document itself (not the popup); otherwise we never get events,
   * perhaps due to focus issues.
   */
  _addListenersWhenPopupShown : function() {
    let that = ImageZoomChrome.Overlay;
    doc = content.document.documentElement;
    that._logger.debug("_addListenersWhenPopupShown for " +
      doc);
    
    // Add a keypress listener so the "Escape" key can hide the popup.
    // We don't use autohide mode since that causes Firefox to ignore
    // a mouse click done while the popup is up, and would prevent the user from
    // clicking the thumb to go to its linked page.
    doc.addEventListener(
      "keypress", that._handleKeypress, false);
  },
  
  /**
   * Removes listeners when the popup image is hidden again, so we don't keep
   * a persistent key listener on the document all the time.
   */
  _removeListenersWhenPopupHidden : function() {
    let that = ImageZoomChrome.Overlay;
    doc = content.document.documentElement;
    that._logger.debug("_removeListenersWhenPopupHidden for " +
      doc);
    doc.removeEventListener(
      "keypress", that._handleKeypress, false);
  },
  
  /**
   * Handles the TabSelect event.
   * @param aEvent the event object.
   */
  _handleTabSelected : function(aEvent) {
    this._logger.trace("_handlePageLoaded");
    this._thumbBBox.xMax = -999;
    this._closePanel();
  },

  /**
   * Handles the DOMContentLoaded event.
   * @param aEvent the event object.
   */
  _handlePageLoaded : function(aEvent) {
    this._logger.trace("_handlePageLoaded");

    this._thumbBBox.xMax = -999;

    let that = this;
    let doc = aEvent.originalTarget;

    if (doc instanceof HTMLDocument) {
      let pageConstant = ImageZoom.FilterService.getPageConstantByDoc(doc);

      if (-1 != pageConstant) {
        doc.addEventListener(
          "mouseover",
          function(aEvent) {
            that._handleMouseOver(doc, aEvent, pageConstant);
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
  _handleMouseOver : function(aDocument, aEvent, aPage) {
    this._logger.trace("_handleMouseOver");

    let x = aEvent.screenX;
    let y = aEvent.screenY;
    if (x >= this._thumbBBox.xMin &&
        x <= this._thumbBBox.xMax &&
        y >= this._thumbBBox.yMin &&
        y <= this._thumbBBox.yMax) {
      // Ignore attempt to redisplay the same image without first entering
      // a different element, on the assumption that it's caused by a
      // focus change after the popup was dismissed.
      return;
    }
    
    this._thumbBBox.xMax = -999;
    
    let node = aEvent.target;
    let imageSource = ImageZoom.FilterService.getImageSource(aDocument, node, aPage);

    if (null != imageSource && this._isKeyActive(aEvent)) {      
      if (ImageZoom.FilterService.isPageEnabled(aPage) &&
          ImageZoom.FilterService.filterImage(imageSource, aPage)) {
        let that = this;

        this._timer.cancel();
        this._timer.initWithCallback({ notify:
          function() { that._showZoomImage(imageSource, node, aPage, aEvent); }
        }, this._getHoverTime(), Ci.nsITimer.TYPE_ONE_SHOT);
      } else {
        // This type of image is disabled or unrecognized. 
        this._closePanel();
      }
    } else {
      // This element isn't an image or the hot key isn't down.
      // This is how we dismiss the popup by moving the mouse out of
      // the thumbnail.
      this._closePanel();
    }
  },

  /**
   * Verifies if the key is active.
   * @param aEvent the event object.
   * @return true if active, false otherwise.
   */
  _isKeyActive : function(aEvent) {
    this._logger.trace("_isKeyActive");

    let active = false;
    let keyPref = ImageZoom.Application.prefs.get(this.PREF_PANEL_KEY);

    switch (keyPref.value) {
      case 1:
        active = aEvent.ctrlKey;
        break;
      case 2:
        active = aEvent.shiftKey;
        break;
      case 3:
        active = aEvent.altKey;
        break;
      default:
        active = true;
        break;
    }

    return active;
  },

  /**
   * Gets the hover time.
   * @return the hover time, 0 by default.
   */
  _getHoverTime : function() {
    this._logger.trace("_getHoverTime");

    let hoverTime = 0;
    let delayPref = ImageZoom.Application.prefs.get(this.PREF_PANEL_WAIT);

    if (delayPref && !isNaN(delayPref.value)) {
      hoverTime = 1000 * delayPref.value;
    }

    return hoverTime;
  },

  /**
   * Shows the zoom image panel.
   * @param aImageSrc the image source
   * @param aImageNode the image node
   * @param aPage the page constant
   */
  _showZoomImage : function(aImageSrc, aImageNode, aPage, aEvent) {
    this._logger.trace("_showZoomImage");

    let zoomImageSrc = ImageZoom.FilterService.getZoomImage(aImageSrc, aPage);

    if (null != zoomImageSrc) {
      this._showPanel(aImageNode, zoomImageSrc, aEvent);
    } else {
      this._closePanel();
    }
  },

  /**
   * Shows the panel.
   * @param aImageNode the image node.
   * @param aImageSrc the image source.
   */
  _showPanel : function(aImageNode, aImageSrc, aEvent) {
    this._logger.trace("_showPanel");

    // reset previous pic.
    this._panelImage.style.maxWidth = "";
    this._panelImage.style.minWidth = "";
    this._panelImage.style.maxHeight = "";
    this._panelImage.style.minHeight = "";
    this._closePanel();

    // open new pic.
    if (this._panel.state != "open") {
      // Pop up the panel, causing the throbber to display near
      // the image thumbnail.
      this._panel.openPopup(aImageNode, "end_before", 30, 30, false, false);
      this._addListenersWhenPopupShown();
    }
    this._currentImage = aImageSrc;
    this._contextMenu.hidden = false;
    this._preloadImage(aImageNode, aImageSrc, aEvent);
  },

  /**
   * Closes the panel.
   */
  _closePanel : function() {
    this._logger.trace("_closePanel");

    this._currentImage = null;
    this._contextMenu.hidden = true;
    this._panelThrobber.hidden = false;
    this._timer.cancel();
    this._removeListenersWhenPopupHidden();
    if (this._panel.state != "closed") {
      this._panel.hidePopup();
    }
    // We no longer need the image contents so help the garbage collector:
    this._panelImage.removeAttribute("src");
  },

  /**
   * Event handler for mouse movement over the popup,
   * which can happen when the popup overlaps the thumbnail.
   * This routine closes the dialog if the mouse is outside
   * the bounds of the thumbnail.
   */
  _handlePopupMove : function(aEvent) {
    let x = aEvent.screenX;
    let y = aEvent.screenY;

    if (x >= this._thumbBBox.xMin &&
        x <= this._thumbBBox.xMax &&
        y >= this._thumbBBox.yMin &&
        y <= this._thumbBBox.yMax) {
      // Mouse is still over the thumbnail.  Ignore the move and don't
      // dismiss since the thumb would immediately receive an 'over' event
      // and retrigger the popup to display.
      this._logger.debug("_handlePopupMove: ignoring since mouse at " +
                         x + "," + y +
                         " is within thumb " +
                         this._thumbBBox.xMin + ".." + this._thumbBBox.xMax + "," +
                         this._thumbBBox.yMin + ".." + this._thumbBBox.yMax);
      return;
    }
    // Non-trivial move; dismiss popup.
    this._logger.debug("_handlePopupMove: closing with mouse at " +
                        aEvent.screenX + "," + aEvent.screenY);
    this._closePanel();
  },

  _handlePopupClick : function(aEvent) {
    this._logger.debug("_handlePopupClick: mouse at " +
                        aEvent.screenX + "," + aEvent.screenY);
    this._closePanel();
  },
  
  _handleKeypress : function(aEvent) {
    let that = ImageZoomChrome.Overlay;
    that._logger.debug("_handleKeypress for "  +
       aEvent.keyCode );
    if (aEvent.keyCode == 27 /* Escape key */) {
      that._closePanel();
    }
  },
  
  /**
   * Preloads the image.
   * @param aImageNode the image node.
   * @param aImageSrc the image source.
   * @param aEvent the mouse event which caused us to preload the image.
   */
  _preloadImage : function(aImageNode, aImageSrc, aEvent) {
    this._logger.trace("_preloadImage");

    let that = this;
    let image = new Image();

    image.onload = function() {
      // Close and (probably) re-open the panel so we can reposition it to
      // display the image.  Note that if the image is too large to
      // fit to the left/right of the thumb, we pop-up relative to the upper-left
      // corner of the browser instead of relative to aImageSrc.
      // This allows us to display larger pop-ups. 
      that._panel.hidePopup();

      if (that._currentImage == aImageSrc) {
        let pageZoom = gBrowser.selectedBrowser.markupDocumentViewer.fullZoom;
        
        let thumbWidth = aImageNode.offsetWidth * pageZoom;
        let thumbHeight = aImageNode.offsetHeight * pageZoom;
        if (image.width < thumbWidth * 1.20 &&
            image.height < thumbHeight * 1.20) {
          that._logger.debug("_preloadImage: skipping: full-size image size (" +
              image.width + " x " + image.height + 
              ") isn't at least 20% bigger than thumb (" +
              thumbWidth + " x " + thumbHeight + ")");
          that._removeListenersWhenPopupHidden();

          return;
        }
        
        clientToScreenX = aEvent.screenX - aEvent.clientX * pageZoom;
        clientToScreenY = aEvent.screenY - aEvent.clientY * pageZoom;
        that._updateThumbBBox(aImageNode, 
                              clientToScreenX, clientToScreenY);
        let available = that._getAvailableSizeOutsideThumb(aImageNode);
        
        // Get the popup image's display size, which is the largest we
        // can display the image (without magnifying it and without it
        // being too big to fit on-screen).
        let imageSize = that._getScaleDimensions(image, available);

        that._logger.debug("_preloadImage: available w/l/r:" + available.width + 
                           "/" + available.left + 
                           "/" + available.right +
                           "; h/t/b:" + available.height + 
                           "/" + available.top + 
                           "/" + available.bottom);
                        that._logger.debug("_preloadImage: " + 
                           "; win width=" + content.window.innerWidth*pageZoom +
                           "; win height=" + content.window.innerHeight*pageZoom +
                           "; full-size image=["+image.width + "," + image.height + 
                           "]; max imageSize which fits=["+imageSize.width + "," + imageSize.height +"]"); 
        
        
        if (imageSize.width <= available.width) {
          if (imageSize.width <= available.right) {
            that._logger.debug("_preloadImage: display to right of thumb"); 
            that._panel.openPopup(aImageNode, "end_before", 15, 0, false, false);
          } else {
            that._logger.debug("_preloadImage: display to left of thumb"); 
            that._panel.openPopup(aImageNode, "start_before", -15, 0, false, false);
          }
        } else if (imageSize.height <= available.height) {
          if (imageSize.height <= available.bottom) {
            that._logger.debug("_preloadImage: display below thumb"); 
            that._panel.openPopup(aImageNode, "after_start", 0, 15, false, false);
          } else {
            that._logger.debug("_preloadImage: display above thumb"); 
            that._panel.openPopup(aImageNode, "before_start", 0, -15, false, false);
          }
        } else {
            that._logger.debug("_preloadImage: display in upper-left of window (overlap thumb)"); 
            that._panel.openPopup(null, "overlap", 15, 15, false, false);
        }
        that._addListenersWhenPopupShown();
        that._showImage(aImageSrc, imageSize);
        
        // Help the garbage collector reclaim memory quickly.
        // (Test by watching "images" size in about:memory.)
        image.src = null;
        delete image;
        image = null;
      }
    };
    image.onerror = function() {
      that._closePanel();
    };

    image.src = aImageSrc;
  },

  /**
   * Updates this._thumbBBox to indicate the range of DOM coordinates spanned
   * by the thumb or link.
   */
  _updateThumbBBox : function(aImageNode, xOffset, yOffset) {
    this._logger.trace("_updateThumbBBox");
    			
    var viewportElement = document.documentElement;  
    var scrollLeft = viewportElement.scrollLeft;
    var scrollTop = viewportElement.scrollTop;
    let pageZoom = gBrowser.selectedBrowser.markupDocumentViewer.fullZoom;
    var box = aImageNode.getBoundingClientRect();

    this._logger.debug("_updateThumbBBox: scroll = " +
                       scrollLeft + "," + scrollTop);
    this._logger.debug("_updateThumbBBox: doc to screen offset = " +
                       xOffset + "," + yOffset);

    this._thumbBBox.xMin = xOffset + box.left * pageZoom + scrollLeft;
		this._thumbBBox.yMin = yOffset + box.top  * pageZoom + scrollTop;
    
    this._thumbBBox.xMax = this._thumbBBox.xMin + aImageNode.offsetWidth * pageZoom;
    this._thumbBBox.yMax = this._thumbBBox.yMin + aImageNode.offsetHeight * pageZoom;
    
    this._logger.debug("_updateThumbBBox: bbox = " +
                       this._thumbBBox.xMin + ".." + this._thumbBBox.xMax + "," +
                       this._thumbBBox.yMin + ".." + this._thumbBBox.yMax);
  },  
  
  /**
   * Returns the width of the larger of the space to the left or
   * right of the thumbnail, and the height of the larger of the space
   * above and below it.  This is the space into which the
   * image would have to fit if we displayed it to the side of or
   * above/below the thumbnail without overlapping it.
   * @param aImageNode the image node.
   * @return An object with .left, .right, .top, .bottom, .width and .height 
   * fields.
   */
  _getAvailableSizeOutsideThumb : function(aImageNode) {
    this._logger.trace("_getAvailableSizeOutsideThumb");
    let pageZoom = gBrowser.selectedBrowser.markupDocumentViewer.fullZoom;

    let pageWidth = content.window.innerWidth * pageZoom;
    let pageHeight = content.window.innerHeight * pageZoom;
    
    /*
     * pageLeft is the space available to the left of the thumb. 
     * pageTop is the space available above it.
     */
    let available = {left: 0, top: 0};
    let pageNode = aImageNode;

    /*
     * Calc the position of the upper-left corner of the thumb by summing
     * offsets from the thumb to its parent, its parent to its grandparent, etc.
     */
    while (null != pageNode) {
      let x = pageNode.offsetLeft * pageZoom;
      let y = pageNode.offsetTop * pageZoom;
      let parentNode = pageNode.parentNode;
      if (parentNode) {
        this._logger.debug("_getAvailableSizeOutsideThumb: scroll offset in " +
                               parentNode + ": x,y = " + 
                               parentNode.scrollLeft * pageZoom + "," +
                               parentNode.scrollTop * pageZoom);
        x -= parentNode.scrollLeft * pageZoom;
        y -= parentNode.scrollTop * pageZoom;
      }
      this._logger.debug("_getAvailableSizeOutsideThumb: in " +
                         pageNode + ": x,y = " + x + "," + y);
      available.left += x;
      available.top += y;
      pageNode = pageNode.offsetParent;
    }
    
    /*
     * pageRight is the space available to the right of the thumbnail,
     * and pageBottom the space below.
     */
    available.right = pageWidth - available.left - aImageNode.offsetWidth * pageZoom;
    available.bottom = pageHeight - available.top - aImageNode.offsetHeight * pageZoom;
    available.width = Math.max(available.left, available.right);
    available.height = Math.max(available.top, available.bottom);

    return available;
  },

  /**
   * Gets the image scale dimensions to fit the window.
   * @param aImage the image info.
   * @param available: contains (width, height) of the max space available
   * to the left or right and top or bottom of the thumb.
   * @return the scale dimensions.
   */
  _getScaleDimensions : function(aImage, available) {
    this._logger.trace("_getScaleDimensions");

    // We allow showing images larger 
    // than would fit entirely to the left or right of
    // the thumbnail by using the full page width
    // instead of calling _getPageSide.
    let pageZoom = gBrowser.selectedBrowser.markupDocumentViewer.fullZoom;
    let pageWidth = content.window.innerWidth * pageZoom - 15;
    let pageHeight = content.window.innerHeight * pageZoom - 15;
    
    let imageWidth = aImage.width;
    let imageHeight = aImage.height;
    let scaleRatio = (imageWidth / imageHeight);
    let scale = { width: imageWidth, height: imageHeight };

    // Make sure scale.width, height is not larger than the window size.
    if (scale.height > pageHeight) {
      scale.height = pageHeight;
      scale.width = Math.round(scale.height * scaleRatio);
    }
    if (scale.width > pageWidth) {
      scale.width = pageWidth;
      scale.height = Math.round(scale.width / scaleRatio);
    }

    // Calc sideScale as the biggest size we can use for the image without
    // overlapping the thumb.
    let sideScale = {width: scale.width, height: scale.height};
    if (imageHeight > available.height) {
      // Try fitting the image's height to available.height (and scaling
      // width proportionally); this corresponds to showing the
      // popup above or below the thumb.
      sideScale.height = available.height;
      sideScale.width = Math.round(sideScale.height * scaleRatio);
    }
    if (sideScale.width < available.width) {
      // We can show the image larger by fitting its width to available.width
      // rather than fitting its height; this allows it to appear to
      // the left or right of the thumb.
      sideScale.width = Math.min(available.width, imageWidth);
      sideScale.height = Math.round(sideScale.width / scaleRatio);
    }
    if (sideScale.height > pageHeight) {
      sideScale.height = pageHeight;
      sideScale.width = Math.round(scale.height * scaleRatio);
    }
    if (sideScale.width > pageWidth) {
      sideScale.width = pageWidth;
      sideScale.height = Math.round(sideScale.width / scaleRatio);
    }

    let allowCoverThumb = ImageZoom.Application.prefs.get(this.PREF_PANEL_LARGE_IMAGE);
    allowCoverThumb = allowCoverThumb && allowCoverThumb.value;

    // Check whether to allow popup to cover thumb.
    if (! allowCoverThumb) {
      this._logger.debug("_getScaleDimensions: disallowing covering thumb because of pref");
      scale = sideScale;
    } else if (scale.width < (sideScale.width * 1.20)) {
      this._logger.debug("_getScaleDimensions: disallowing covering " + 
                         "thumb because covering width " + scale.width +
                         " isn't at least 20% bigger than uncovered width " +
                         sideScale.width);
      scale = sideScale;
    }

    return scale;
  },

  /**
   * Shows the image in the panel.
   * @param aImageSrc the image source.
   * @param aScale the scale dimmensions.
   */
  _showImage : function(aImageSrc, aScale) {
    this._logger.trace("_showImage");

    if (aScale) {
      this._panelImage.style.maxWidth = aScale.width + "px";
      this._panelImage.style.minWidth = aScale.width + "px";
      this._panelImage.style.maxHeight = aScale.height + "px";
      this._panelImage.style.minHeight = aScale.height + "px";
    }
    this._panelImage.src = aImageSrc;
    this._panelThrobber.hidden = true;
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
   * Downloads the full image.
   */
  downloadImage : function() {
    this._logger.debug("downloadImage");

    if (null != this._currentImage) {
      let fileURL = this._currentImage;
      let filePickerResult = null;
      let filePickerName =
        fileURL.substring(fileURL.lastIndexOf('/') + 1, fileURL.length);

      this._filePicker.defaultString = filePickerName;
      filePickerResult = this._filePicker.show();

      if (Ci.nsIFilePicker.returnOK == filePickerResult ||
          Ci.nsIFilePicker.returnReplace == filePickerResult) {
        let filePath = this._filePicker.file.path;
        let image = new Image();

        image.onload = function() {
          ImageZoom.DownloadService.downloadImage(
            image, filePath, window);
        };
        image.src = fileURL;
      }
    }
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
   * Updates the pages menu.
   * @param aPage the page constant.
   */
  _updatePagesMenu : function(aPage) {
    this._logger.trace("_updatePagesMenu");

    let pageName = ImageZoom.FilterService.getPageName(aPage);
    let pageEnable = ImageZoom.FilterService.isPageEnabled(aPage);
    let menuItemId = "imagezoom-toolbar-menuitem-" + pageName;
    let menuItem = document.getElementById(menuItemId);

    if (null != menuItem) {
      menuItem.setAttribute("checked", pageEnable);
    }
  },

  /**
   * Shows the panel border based in the preference value.
   */
  _showPanelBorder : function() {
    this._logger.trace("_showPanelBorder");

    let panelBorder = ImageZoom.Application.prefs.get(this.PREF_PANEL_BORDER);

    if (panelBorder && panelBorder.value) {
      this._panel.removeAttribute("panelnoborder");
    } else {
      this._panel.setAttribute("panelnoborder", true);
    }
  },

  /**
   * Updates the panel opacity based in the preference value.
   */
  _updatePanelOpacity : function() {
    this._logger.trace("_updatePanelOpacity");

    let panelOpacity = ImageZoom.Application.prefs.get(this.PREF_PANEL_OPACITY);

    if (panelOpacity && panelOpacity.value) {
      this._panel.style.opacity = panelOpacity.value / 100;
    }
  },

  /**
   * Observes the authentication topic.
   * @param aSubject The object related to the change.
   * @param aTopic The topic being observed.
   * @param aData The data related to the change.
   */
  observe : function(aSubject, aTopic, aData) {
    this._logger.debug("observe");

    if ("nsPref:changed" == aTopic &&
        -1 != aData.indexOf(ImageZoom.PrefBranch)) {
      if (-1 != aData.indexOf(".enable")) {
        let page =
          aData.replace(ImageZoom.PrefBranch, "").replace(".enable", "");
        let pageConstant = ImageZoom.FilterService.getPageConstantByName(page);

        if (-1 != pageConstant) {
          this._updatePagesMenu(pageConstant);
        }
      } else {
        switch (aData) {
          case this.PREF_PANEL_BORDER:
            this._showPanelBorder();
            break;
          case this.PREF_PANEL_OPACITY:
            this._updatePanelOpacity();
            break;
        }
      }
    }
  }
};

window.addEventListener(
  "load", function() { ImageZoomChrome.Overlay.init(); }, false);
window.addEventListener(
  "unload", function() { ImageZoomChrome.Overlay.uninit(); }, false);
