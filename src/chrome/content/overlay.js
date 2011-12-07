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

"use strict";

Cu.import("resource://thumbnailzoomplus/common.js");
Cu.import("resource://thumbnailzoomplus/pages.js");
Cu.import("resource://thumbnailzoomplus/filterService.js");
Cu.import("resource://thumbnailzoomplus/downloadService.js");
Cu.import("resource://thumbnailzoomplus/uninstallService.js");

/**
 * Controls the browser overlay.
 */
ThumbnailZoomPlusChrome.Overlay = {
  /* UI preference keys. */
  PREF_PANEL_KEY : ThumbnailZoomPlus.PrefBranch + "panel.key",
  PREF_PANEL_WAIT : ThumbnailZoomPlus.PrefBranch + "panel.wait",
  PREF_PANEL_DELAY : ThumbnailZoomPlus.PrefBranch + "panel.delay",
  PREF_PANEL_BORDER : ThumbnailZoomPlus.PrefBranch + "panel.border",
  PREF_PANEL_LARGE_IMAGE : ThumbnailZoomPlus.PrefBranch + "panel.largeimage",
  PREF_PANEL_HISTORY : ThumbnailZoomPlus.PrefBranch + "panel.history",
  PREF_PANEL_OPACITY : ThumbnailZoomPlus.PrefBranch + "panel.opacity",
  /* Toolbar button preference key. */
  PREF_TOOLBAR_INSTALLED : ThumbnailZoomPlus.PrefBranch + "button.installed",

  /* Logger for this object. */
  _logger : null,
  /* Preferences service. */
  _preferencesService : null,

  /* The timer, which is used:
   *   - for the user-configured delay from when the user hovers until
   *     we start trying to load an image.
   *   - for the repeating timer after we start loading to poll whether we
   *     have loaded enough to know image dimensions and thus show the full-size
   *     image.
   */
  _timer : null,
  /* The floating panel. */
  _panel : null,
  /* The floating panel image. */
  _panelImage : null,
  /* The current image source. */
  _currentImage : null,
  /* Context download image menu item */
  _contextMenu : null,
  /* File Picker. */
  _filePicker : null,
  /* _thumbBBox is the bounding box of the thumbnail or link which caused
     the popup to launch, in screen coordinates. 
     refScroll{Left,Top} are the window scroll amounts implicit in the bbox
     coords.  If the window might now be scrolled differently, subtract
     these values from the coordinates and add the current window scroll
     (as _insideThumbBBox does). */
  _thumbBBox : { xMin: 999, xMax: -999, yMin: 999, yMax: -999,
                 refScrollLeft: 0, refScrollTop: 0},
  
  // _borderWidth is the spacing in pixels between the edge of the thumb and the popup.
  _borderWidth : 5, // border itself adds 5 pixels on each edge.
  
  // _widthAddon is additional image width due to border if enabled:
  // 0 or _borderWidth*2.
  _widthAddon : 0,
  _pad : 5,
  
  // _currentWindow is the window from which the current popup was launched.
  // We use this to detect when a different document has been loaded into that
  // window (as opposed to a different window).
  _currentWindow : null,
  
  // _originalURI is the URL _currentWindow had when we last showed the popup.
  _originalURI : "",
  
  /**
   * Initializes the object.
   */
  init : function() {
    this._logger = ThumbnailZoomPlus.getLogger("ThumbnailZoomPlusChrome.Overlay");
    this._logger.debug("init");

    this._preferencesService =
      Cc["@mozilla.org/preferences-service;1"].getService(Ci.nsIPrefBranch2);
    this._timer = Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer);
    this._panel = document.getElementById("thumbnailzoomplus-panel");
    this._panelImage = document.getElementById("thumbnailzoomplus-panel-image");
    this._contextMenu = document.getElementById("thumbnailzoomplus-context-download");

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

    let delayPref = ThumbnailZoomPlus.Application.prefs.get(this.PREF_PANEL_DELAY);
    if (delayPref) {
      let preferenceService =
        Cc["@mozilla.org/preferences-service;1"].getService(Ci.nsIPrefBranch);
      let delayValue = String(delayPref.value);

      ThumbnailZoomPlus.Application.prefs.setValue(this.PREF_PANEL_WAIT, delayValue);
      preferenceService.clearUserPref(this.PREF_PANEL_DELAY);
    }
  },


  /**
   * Installs the toolbar button on the first run.
   */
  _installToolbarButton : function() {
    this._logger.trace("_installToolbarButton");

    let buttonInstalled =
      ThumbnailZoomPlus.Application.prefs.get(this.PREF_TOOLBAR_INSTALLED).value;

    if (!buttonInstalled) {
      let toolbarId =
        (null == document.getElementById("addon-bar") ? "nav-bar": "addon-bar");
      let toolbar = document.getElementById(toolbarId);
      let newCurrentSet = null;

      if (-1 != toolbar.currentSet.indexOf("urlbar-container")) {
         newCurrentSet = toolbar.currentSet.replace(
           /urlbar-container/, "thumbnailzoomplus-toolbar-button,urlbar-container");
      } else {
         newCurrentSet = toolbar.currentSet + ",thumbnailzoomplus-toolbar-button";
      }
      toolbar.setAttribute("currentset", newCurrentSet);
      toolbar.currentSet = newCurrentSet;
      document.persist(toolbarId, "currentset");

      try {
        BrowserToolboxCustomizeDone(true);
      } catch (e) { }

      ThumbnailZoomPlus.Application.prefs.setValue(this.PREF_TOOLBAR_INSTALLED, true);
    }
  },


  /**
   * Adds the preference observers.
   * @param aValue true if adding, false when removing.
   */
  _addPreferenceObservers : function(aValue) {
    this._logger.debug("_addPreferenceObservers");

    let pageCount = ThumbnailZoomPlus.FilterService.pageList.length;
    let preference = null;
    let pageInfo = null;

    for (let i = 0; i < pageCount; i++) {
      pageInfo = ThumbnailZoomPlus.FilterService.pageList[i];
      preference = ThumbnailZoomPlus.PrefBranch + pageInfo.key + ".enable";

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

    let menuPopup = document.getElementById("thumbnailzoomplus-toolbar-menu");

    if (menuPopup) {
      let menuSeparator =
        document.getElementById("thumbnailzoomplus-toolbar-menuseparator");
      let menuItem = null;
      let pageCount = ThumbnailZoomPlus.FilterService.pageList.length;
      let pageInfo = null;

      for (let i = 0; i < pageCount; i++) {
        pageInfo = ThumbnailZoomPlus.FilterService.pageList[i];
        menuItem = document.createElement("menuitem");
        menuItem.setAttribute("id", 
                              "thumbnailzoomplus-toolbar-menuitem-" + pageInfo.key);
        
        let name = pageInfo.name;
        if (name == "") {
          // Get name from the <XXXENTITYREF ENTITYkey="..."> attribute if it exists; 
          // this is how we get localized names based on locale.dtd entity
          // definitions.
          name = document.getElementById("thumbnailzoomplus-options-page-names")
                           .getAttribute("ENTITY" + pageInfo.key);
            this._logger.debug("addMenuItems: name from entity=" + name);
            ThumbnailZoomPlus.FilterService.pageList[i].name = name;
        }
        this._logger.debug("addMenuItems: name=" + name);
        menuItem.setAttribute("label", name);
        menuItem.setAttribute("type", "checkbox");
        { 
          let aPage = i;
          menuItem.addEventListener("command",
              function() { ThumbnailZoomPlusChrome.Overlay.togglePreference(aPage);},
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

    let menuPopup = document.getElementById("thumbnailzoomplus-toolbar-menu");

    if (menuPopup) {
      let menuSeparator =
        document.getElementById("thumbnailzoomplus-toolbar-menuseparator");

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
    
    // These handlers are on the popup's window, not the document's:
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
    
    /*
     * For dragging tab into empty space (make new window):
     * Add listeners in any pre-existing documents.  Normally there won't 
     * be any yet (except maybe about:none for the initial empty tab).  But
     * when a tab is dragged out to make a new window, we don't get a loaded
     * event for the doc (since it was already loaded before), but its doc
     * will already be existing when we initialize chrome for the new window. 
     */
    for (let i=0; i < gBrowser.browsers.length; i++) {
      this._logger.debug("_addEventListeners: " +
                         " pre-existing doc #" + i + ": " + gBrowser.getBrowserAtIndex(i).contentDocument);
      this._addEventListenersToDoc(gBrowser.getBrowserAtIndex(i).contentDocument);
    }
  },


  /**
   * Adds listeners when the popup image is shown.  The listener is added
   * on the document itself (not the popup); otherwise we never get events,
   * perhaps due to focus issues.
   */
  _addListenersWhenPopupShown : function() {
    this._logger.trace("_addListenersWhenPopupShown");

    let doc = content.document.documentElement;
    this._logger.debug("_addListenersWhenPopupShown: for " +
                       doc);
    
    /*
     * Add key listeners so the "Escape" key can hide the popup.
     * We make sure the web site won't see the Escape key by handling
     * all three of keydown, keyup, and keypress; that keeps for example
     * reddpics.com from refreshing the page when we hit Escape.
     * This is only active while the pop-up is displayed.
     */
    doc.addEventListener("keyup", this._handleKeyUp, true);
    doc.addEventListener("keypress", this._handleIgnoreEsc, true);
    doc.addEventListener("keydown", this._handleIgnoreEsc, true);
      
    /*
     * Listen for pagehide events to hide the popup when navigating away
     * from the page.  Some pages like deviantart use hashtags like
     * deviantart.com/#abcde to go to different pages; we must watch for
     * that with hashchange (it doesn't get a pagehide).
     */
    window.addEventListener("pagehide", this._handlePageHide, false);
    window.addEventListener("hashchange", this._handleHashChange, false);
  },
  
  
  /**
   * Removes listeners when the popup image is hidden again, so we don't keep
   * a persistent key listener on the document all the time.
   */
  _removeListenersWhenPopupHidden : function() {
    let that = ThumbnailZoomPlusChrome.Overlay;
    let doc = content.document.documentElement;
    that._logger.debug("_removeListenersWhenPopupHidden for " +
                       doc);
    doc.removeEventListener("keyup", this._handleKeyUp, true);
    doc.removeEventListener("keypress", this._handleIgnoreEsc, true);
    doc.removeEventListener("keydown", this._handleIgnoreEsc, true);
      
    window.removeEventListener(
      "pagehide", that._handlePageHide, false);
    window.removeEventListener(
      "hashchange", that._handleHashChange, false);
  },
  
  
  /**
   * Handles the TabSelect event.
   * @param aEvent the event object.
   */
  _handleTabSelected : function(aEvent) {
    this._logger.trace("_handleTabSelected");

    /*
     * When a tab is dragged from one window to another pre-existing window,
     * we need to update its listeners to be ones in chrome of the new host
     * window.
     */
    var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
                .getService(Components.interfaces.nsIWindowMediator);
    var browserWindow = wm.getMostRecentWindow("navigator:browser");
    let that = browserWindow.ThumbnailZoomPlusChrome.Overlay;
    this._logger.debug("_handleTabSelected: other win=" + that._currentWindow);
    that._addEventListenersToDoc(gBrowser.contentDocument);

    this._thumbBBox.xMax = -999; // don't reject next move as trivial.
    this._logger.debug("_handleTabSelected: _closePanel since tab selected");
    this._closePanel();
  },
  
  
  /**
   * Handles the DOMContentLoaded event.  Note that this gets called
   * not only for the html page itself, but also for each embedded image
   * or other document.  As a result, it can attach listeners e.g. to an
   * image based on the 'page' of the image's URL, even if that's different
   * than the 'page' of the html doc.
   *
   * TODO: not sure if this needs to run for iframes; currently it does.
   * can detect as if(event.originalTarget.defaultView.frameElement)...
   *
   * @param aEvent the event object.
   */
  _handlePageLoaded : function(aEvent) {
    this._logger.trace("_handlePageLoaded");
    let doc = aEvent.originalTarget;
    this._addEventListenersToDoc(doc);

    if (this._needToPopDown(doc.defaultView.top)) {
      // Detected that the user loaded a different page into our window, e.g.
      // by clicking a link.  So close the popup.
      this._logger.debug("_handlePageLoaded: *** closing since a page loaded into its host window");
      this._closePanel();
    }
  },
  
  // _addEventListenersToDoc adds listeners to the specified document
  // for mouseover events.  Keep in mind the different contexts:
  // the document itself persists even when a tab is moved to a different window,
  // until the document is closed or reloaded.  The window stays associated
  // with its original window, and doesn't change when a tab is dragged.
  //
  // The listener we register ends up being bound to both the window and the doc,
  // since "this" belongs to the window.  That causes complications, like the
  // popup appearing in the old window when a tab is dragged to a new window.
  _addEventListenersToDoc: function(doc) {
    this._logger.trace("_addEventListenersToDoc");

    this._thumbBBox.xMax = -999;

    let that = this;

    if (doc instanceof HTMLDocument) {
      this._logger.debug("............................"); 

    if (doc.location &&
        ("http:" == doc.location.protocol ||
         "https:" == doc.location.protocol) &&
        (doc.location.host == "api.twitter.com" ||
         doc.location.host == "adjax.flickr.yahoo.com") ) {
        // Don't add handlers when Twitter's API doc is opened; doing so
        // would cause us to register an extra set of handlers.
        // TODO: I don't know a general way to detect this situation (eg
        // for other sites).
        this._logger.debug("_addEventListenersToDoc: ignoring host " + doc.location.host);
        return;
      }

      // Try to detect if we're already registered, e.g. so we don't
      // reregister due to autopager. 
      if ("undefined" == typeof(doc.ThumbnailZoomPlus)) {
        doc.ThumbnailZoomPlus = {addedListeners: null};
      }
      this._logger.debug("_addEventListenersToDoc: addedListeners=" +
                         doc.ThumbnailZoomPlus.addedListeners); 

      if (doc.ThumbnailZoomPlus.addedListeners == this) {
        this._logger.debug("_addEventListenersToDoc: Already has handlers; returning."); 
        return;
      } else if (doc.ThumbnailZoomPlus.addedListeners != null) {
        // We'd like to unregister the existing listeners on doc and
        // doc.ThumbnailZoomPlus.addedListeners, so the popup won't keep
        // appearing in the old window after dragging a tab to a new window.
        // But I'm not sure how to unregister it since it was created with an
        // implicit function (a closure).  Instead we effectively disable its mouseover
        // using bbox (making bbox cover everywhere).
        this._logger.debug("_addEventListenersToDoc: A different window has handlers; disabling them."); 
        doc.ThumbnailZoomPlus.addedListeners._thumbBBox.xMin = -99999;
        doc.ThumbnailZoomPlus.addedListeners._thumbBBox.xMax =  99999;
        doc.ThumbnailZoomPlus.addedListeners._thumbBBox.yMin = -99999;
        doc.ThumbnailZoomPlus.addedListeners._thumbBBox.yMax =  99999;
      }
      doc.ThumbnailZoomPlus.addedListeners = this;

      let pageConstant = ThumbnailZoomPlus.FilterService.getPageConstantByDoc(doc, 0);
      this._logger.debug("_addEventListenersToDoc: *** currently, cw=" + 
                           (this._currentWindow == null ? "null" : 
                           this._currentWindow.document == null ? "nullD" :
                           this._currentWindow.document.documentURI) +
                           "   vs   event=" + 
                           (doc.defaultView == null ? "null" :
                           doc.defaultView.top.document == null ? "nullD" :
                           doc.defaultView.top.document.documentURI) );

      if (-1 != pageConstant) {
        doc.addEventListener(
          "mouseover",
          function(aEvent) {
            that._handleMouseOver(doc, aEvent, pageConstant);
          }, true);
      } else {
        this._logger.debug("_addEventListenersToDoc: not on a matching site: " + doc.documentURI);
      }
    } else {
      this._logger.debug("_addEventListenersToDoc: not on an HTML doc: " + doc.documentURI);
    }
  },
  
  _insideThumbBBox : function(doc, x,y) {
    // TODO: this is used to prevent re-showing a popup after we get
    // an event in the doc's window when the user dismisses a popup which is
    // covering the mouse via Escape or mouse-click.  The problem is that 
    // this also prevents us from triggering a new popup when the user moves
    // the mouse onto a different element which is enclosed by the original
    // popup element, e.g. in the "themanatli" tumblr theme, 
    // http://safe.tumblr.com/theme/preview/9540
    //
    // Another problem is that moving out of a <a> link which spans a line
    // may not trigger a pop-down.  That's because when moving out of it,
    // the mouse may still be within the bbox (since the link goes down to a
    // second line, but not horizonally where the mouse is).  When the mouse
    // later leaves the bbox, there is no hover even since it's still in the
    // same paragraph of text.
    //
    // A better alternative might be to ignore
    // mouse over events for 0.1 seconds after an Escape or click which pops
    // down a popup.  Note that after Esc, multiple events may be sent if
    // multiple elements are stacked under the mouse position, complicating
    // bbox checks.  Or check the URL if the image we would popup, and 
    // suppress if it's the same image and within a short duration of the pop-
    // down.  Or always popdown without looking at bbox if the newly entered
    // element doesn't correspond to something we'd popup for.
    
    var viewportElement = doc.documentElement;  
    var scrollLeft = viewportElement.scrollLeft;
    var scrollTop = viewportElement.scrollTop;
    if (typeof(gBrowser) == "undefined") {
      // This happens after moving the final remaining tab in a window
      // to a different window, and then hovering an image in the moved tab.
      // I think the problem is taht events are still registered on the <img>
      // sub-documents from the original tab's load.  We work around it by
      // declaring inside the thumb bbox, so the move event will be ignored.
      this._logger.debug("_insideThumbBBox: returning true since no gBrowser");
      return true;
    }
    let pageZoom = gBrowser.selectedBrowser.markupDocumentViewer.fullZoom;

    var adj = this._thumbBBox;
    // Adjust the bounding box to account for scrolling.  Note that the box's
    // position on-screen moves the opposite direction than the scroll amount.
    var xOffset = (adj.refScrollLeft - scrollLeft) * pageZoom; 
    var yOffset = (adj.refScrollTop - scrollTop) * pageZoom;
    adj.xMin += xOffset;
    adj.xMax += xOffset;
    adj.yMin += yOffset;
    adj.yMax += yOffset;

    var inside = (x >= adj.xMin &&
                  x <= adj.xMax &&
                  y >= adj.yMin &&
                  y <= adj.yMax);
    if (0) this._logger.debug("_insideThumbBBox: orig scroll=" +
                       adj.refScrollLeft + "," + adj.refScrollTop +
                      "; cur scroll=" +
                      scrollLeft + "," + scrollTop +
                      "; scaled diff = " + xOffset+
                      "," + yOffset );
    this._logger.debug("_insideThumbBBox: adj=" +
                       adj.xMin + ".." + adj.xMax + "," +
                       adj.yMin + ".." + adj.yMax +
                       " vs " + x + "," + y + ": " +
                       (inside ? "inside" : "outside") );
    return inside;
  },
  
  /**
   * Handles the mouse over event.
   * @param aEvent the event object.
   * @param aPage the filtered page.
   */
  _handleMouseOver : function(aDocument, aEvent, aPage) {
    this._logger.debug("___________________________");
    this._logger.trace("_handleMouseOver");

    if (this._needToPopDown(aDocument.defaultView.top)) {
      this._logger.debug("_handleMouseOver: _closePanel since different doc.");
      this._closePanel();
      return;
    }
    let x = aEvent.screenX;
    let y = aEvent.screenY;
    if (this._insideThumbBBox(aDocument, x, y)) {
      // Ignore attempt to redisplay the same image without first entering
      // a different element, on the assumption that it's caused by a
      // focus change after the popup was dismissed.
      return;
    }
    
    this._thumbBBox.xMax = -999;
    
    if (! this._isKeyActive(aEvent)) {
      this._logger.debug("_handleMouseOver: _closePanel since hot key not down");
      this._closePanel();
      return;
    }
    
    this._logger.debug("_handleMouseOver: this win=" + this._currentWindow);
    let node = aEvent.target;

    // Close the previously displayed popup (if any).
    this._closePanel();

    if (node == null) {
      this._logger.debug("_handleMouseOver: event.target=null; ignoring");
      return;
    }
    if (node.localName == null) {
      // reported by user on Ubuntu Linux.
      this._logger.debug("_handleMouseOver: event.target.localName=null; ignoring");
      return;
    }

    // Start a timer to try to load the image after the configured
    // hover delay time. 
    let that = this;
    this._timer.cancel();
    this._timer.initWithCallback({ notify:
        function() { that._findPageAndShowImage(aDocument, aEvent, aPage, node); }
      }, this._getHoverTime(), Ci.nsITimer.TYPE_ONE_SHOT);
  },


  _findPageAndShowImage : function(aDocument, aEvent, aPage, node) {
    this._logger.trace("_findPageAndShowImage"); 

    /*
     * Try each maching page (rule), starting with the one we found for the
     * document itself when we loaded it, until we find one which can generate
     * an image URL.
     */

    let foundAnyImageSource = false;
    while (aPage >= 0) {
      this._logger.debug("... _findPageAndShowImage: Trying page '" + 
                         ThumbnailZoomPlus.FilterService.pageList[aPage].key +
                         "'");

      let imageSource = ThumbnailZoomPlus.FilterService.getImageSource(aDocument, node, aPage);
      
      if (null != imageSource) {      
        if (ThumbnailZoomPlus.FilterService.isPageEnabled(aPage) &&
            ThumbnailZoomPlus.FilterService.filterImage(imageSource, aPage)) {
          // Found a matching page!
          foundAnyImageSource = true;
          let zoomImageSrc = ThumbnailZoomPlus.FilterService.getZoomImage(imageSource, aPage);
          if (zoomImageSrc == "") {
            this._logger.debug("_findPageAndShowImage: getZoomImage returned '' (matched but disabled by user).");
            foundAnyImageSource = false;
          } else if (zoomImageSrc == null) {
            this._logger.debug("_findPageAndShowImage: getZoomImage returned null.");
          } else {
            this._currentWindow = aDocument.defaultView.top;
            this._originalURI = this._currentWindow.document.documentURI;
            this._logger.debug("_findPageAndShowImage: *** Setting _originalURI=" + 
                               this._originalURI);
            
            this._showZoomImage(zoomImageSrc, node, aPage, aEvent);
            return;
          }
        }
      }
      
      // Try to find another matching page.
      aPage = ThumbnailZoomPlus.FilterService.getPageConstantByDoc(aDocument, aPage+1);
    }
    if (false && foundAnyImageSource) {
      // Originally I thought it'd be helpful to indicate a recognized site
      // whose particular link we don't recognize.  But it turns out to just be
      // distracting to the user, and forces the developer to make more specific
      // imageRegExp patterns which are redundant with getZoomImage().
      // So this code is disabled.
      this._logger.debug("_findPageAndShowImage: show noMatchingRule icon briefly " +
                         "since mouse not in recognized URL or site disabled");
      this._showStatusIconBriefly(node, "noMatchingRule16.png", 32);      
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
    let keyPref = ThumbnailZoomPlus.Application.prefs.get(this.PREF_PANEL_KEY);
    if (! keyPref) {
      return true;
    }
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
    let delayPref = ThumbnailZoomPlus.Application.prefs.get(this.PREF_PANEL_WAIT);

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
  _showZoomImage : function(zoomImageSrc, aImageNode, aPage, aEvent) {
    this._logger.trace("_showZoomImage");
    this._showPanel(aImageNode, zoomImageSrc, aEvent);
  },


  /**
   * Shows the panel.
   * @param aImageNode the image node.
   * @param aImageSrc the image source.
   */
  _showPanel : function(aImageNode, aImageSrc, aEvent) {
    this._logger.trace("_showPanel");

    this._logger.debug("_showPanel: _closePanel since closing any prev popup before loading new one");
    this._closePanel();

    this._originalURI = this._currentWindow.document.documentURI;
    this._currentImage = aImageSrc;
    
    // Allow the user to see the context (right-click) menu item for
    // "Save Enlarged Image As...".
    this._contextMenu.hidden = false;
    this._preloadImage(aImageNode, aImageSrc, aEvent);
  },

  /**
   * Closes the panel.
   */
  _closePanel : function() {
    try {
      // When called from _handlePageHide after closing window with Control+W
      // while popup is up, some of the statements below raise exceptions
      // e.g. there is no this._contextMenu.  I suspect it's because the
      // chrome is already being destroyed when this is called.  So we
      // silently ignore exceptions here.
      this._logger.trace("_closePanel");
      
      this._currentImage = null;
      this._contextMenu.hidden = true;
      this._timer.cancel();
      this._removeListenersWhenPopupHidden();
      this._originalURI = "";
      if (this._panel.state != "closed") {
        this._panel.hidePopup();
      }
      // We no longer need the image contents, and don't want them to show
      // next time we show the working dialog.  This also helps the garbage 
      // collector:
      this._panelImage.src = null;
      this._panelImage.removeAttribute("src");
    } catch (e) {
      this._logger.debug("_closePanel: exception: " + e);
    }
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
    // moved outside bbox of thumb; dismiss popup.
    this._logger.debug("_handlePopupMove: closing with mouse at " +
                        aEvent.screenX + "," + aEvent.screenY);
    this._closePanel();
  },


  _handlePopupClick : function(aEvent) {
    this._logger.debug("_handlePopupClick: mouse at " +
                        aEvent.screenX + "," + aEvent.screenY);
    this._closePanel();
  },
  
  _handleKeyUp : function(aEvent) {
    let that = ThumbnailZoomPlusChrome.Overlay;
    that._logger.debug("_handleKeyUp for "  + aEvent.keyCode );
    if (aEvent.keyCode == 27 /* Escape key */) {
      that._logger.debug("_handleKeyUp: _closePanel since pressed Esc key");
      that._closePanel();
      
      aEvent.stopPropagation(); // the web page should ignore the key.
      aEvent.preventDefault();
    }
  },
  
  _handleIgnoreEsc : function(aEvent) {
    let that = ThumbnailZoomPlusChrome.Overlay;
    that._logger.debug("_handleIgnoreEsc for "  + aEvent.keyCode );
    if (aEvent.keyCode == 27 /* Escape key */) {
      that._logger.debug("_handleIgnoreEsc: ignoring Esc key");
      aEvent.stopPropagation(); // the web page should ignore the key.
      aEvent.preventDefault();
    }
  },
  
  _needToPopDown : function(affectedWindow) {
    let needTo = 
      (this._originalURI != "" &&
       this._currentWindow == affectedWindow &&
       this._originalURI != affectedWindow.document.documentURI);
    this._logger.debug("_needToPopDown: returning " + needTo + 
                       " for _originalURI=" + this._originalURI +
                       "   vs affectedWindow=" + affectedWindow.document.documentURI);
    
    return needTo;
  },
  
  _handlePageHide : function(aEvent) {
    let that = ThumbnailZoomPlusChrome.Overlay;
    let affectedWindow = aEvent.originalTarget.defaultView.top;
    that._logger.trace("_handlePageHide");
    if (this._currentWindow == affectedWindow) {
      that._logger.debug("_handlePageHide: closing panel");
      that._closePanel();
    }
    return true; // allow page to hide
  },
  
  _handleHashChange : function(aEvent) {
    let that = ThumbnailZoomPlusChrome.Overlay;
    that._logger.trace("_handleHashChange");
    that._logger.debug("_handleHashChange: closing panel");
    that._closePanel();
  },
  
  _showStatusIcon : function(aImageNode, iconName, iconWidth) {
    this._logger.trace("_showStatusIcon");
    
    this._logger.debug("_showStatusIcon: showing " + iconName);

    this._panelImage.style.backgroundImage =
      "url(\"chrome://thumbnailzoomplus/skin/images/" + iconName + "\")";
    this._panelImage.style.maxWidth = iconWidth + "px";
    this._panelImage.style.minWidth = iconWidth + "px";
    this._panelImage.style.maxHeight = "16px";
    this._panelImage.style.minHeight = "16px";

    if (this._panel.state != "open") {
      this._logger.debug("_showStatusIcon: popping up to show " + iconName);
      this._panel.openPopup(aImageNode, "end_before", this._pad, this._pad, false, false);
      this._addListenersWhenPopupShown();
    }
  },
  
  _showStatusIconBriefly : function(aImageNode, iconName, iconWidth) {
    this._logger.trace("_showStatusIconBriefly");

    // We don't want to see any image on top of the icon.
    this._panelImage.src = null;
    this._showStatusIcon(aImageNode, iconName, iconWidth);
    
    // Hide the icon after a little while
    this._timer.cancel();
    let that = this;
    this._timer.initWithCallback(
        { notify: function() { that._closePanel(); } }, 
        1.5 * 1000, Ci.nsITimer.TYPE_ONE_SHOT);
  },
  
  /**
   * _checkIfImageLoaded is called from a repeating timer after we
   * start loading.  It checks whether enough has been loaded to
   * know image dimensions.  If so, it displays the full-size popup
   * (which cancels the timer).
   */
  _checkIfImageLoaded : function(aImageNode, aImageSrc, 
                               clientToScreenX, clientToScreenY,
                               image)
  {
    this._logger.trace("_checkIfImageLoaded");
    if (this._currentImage != aImageSrc) {
      this._logger.debug("_checkIfImageLoaded: ignoring (different window).");
      return;
    }

    if (this._panel.state != "open") {
      // Show the panel even without its image so the user will at
      // least see our icon and know it's being loaded.
      this._logger.debug("_checkIfImageLoaded: showing popup as 'working' indicator.");
      // Set to our status icon as a "working" indicator
      // while loading.  This normally appears only briefly (or not at all)
      // since we show the full image size as soon as enough of the image is
      // loaded to know its dimensions.
      this._showStatusIcon(aImageNode, "icon16.png", 16);      
    }
    
    if (image.width > 0 && image.height > 0) {
      this._logger.debug("_checkIfImageLoaded: delayed-calling _imageOnLoad since have size.");
      /*
       * The image has a size so we could technically display it now.  But that
       * often causes it to appear very briefly only half-displayed, with
       * its lower half white.  We try to prevent that by displaying it a bit
       * later, using the timer again.
       */
      this._timer.cancel();
      let that = this;
      this._timer.initWithCallback(
        { notify:
          function() {
            that._imageOnLoad(aImageNode, aImageSrc, 
                             clientToScreenX, clientToScreenY,
                             image);
          }
         }, 0.7 * 1000, Ci.nsITimer.TYPE_ONE_SHOT);
    } 
  },

  /**
   * _imageOnLoad displays the full-size image (if it's called on the
   * appropriate image's window).
   * This is called from the image's onLoad handler and also from
   * _checkIfImageLoaded if enough of the image is loaded to know
   * its dimensions.
   */
  _imageOnLoad : function(aImageNode, aImageSrc, 
                               clientToScreenX, clientToScreenY,
                               image)
  {
    this._logger.trace("_imageOnLoad");

    // Make sure we don't get called again as an onLoad, if current call
    // was due to the timer.
    image.onload = null;

    if (this._currentImage == aImageSrc) {
      this._timer.cancel();
      // This is the image URL we're currently loading (not another previously
      // image we had started loading).
      let pageZoom = gBrowser.selectedBrowser.markupDocumentViewer.fullZoom;
      
      this._updateThumbBBox(aImageNode, 
                            clientToScreenX, clientToScreenY);
      let available = this._getAvailableSizeOutsideThumb(aImageNode);
      let thumbWidth = aImageNode.offsetWidth * pageZoom;
      let thumbHeight = aImageNode.offsetHeight * pageZoom;

      // Get the popup image's display size, which is the largest we
      // can display the image (without magnifying it and without it
      // being too big to fit on-screen).
      let imageSize = this._getScaleDimensions(image, available,
                                               thumbWidth, thumbHeight);
      
      this._logger.debug("_imageOnLoad: available w/l/r:" + available.width + 
                         "/" + available.left + 
                         "/" + available.right +
                         "; h/t/b:" + available.height + 
                         "/" + available.top + 
                         "/" + available.bottom);
      this._logger.debug("_imageOnLoad: " + 
                         "win width=" + content.window.innerWidth*pageZoom +
                         "; win height=" + content.window.innerHeight*pageZoom +
                         "; full-size image=["+image.width + "," + image.height + 
                         "]; max imageSize which fits=["+imageSize.width + "," + imageSize.height +"]"); 
      
      if (! imageSize.allow) {
        this._showStatusIconBriefly(aImageNode, "tooSmall16.png", 32);      

        return;
      }
      
      this._openAndPositionPopup(aImageNode, aImageSrc, imageSize, available);
      
      // Help the garbage collector reclaim memory quickly.
      // (Test by watching "images" size in about:memory.)
      image.src = null;
      image = null;
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
    
    let pageZoom = gBrowser.selectedBrowser.markupDocumentViewer.fullZoom;
    let clientToScreenX = aEvent.screenX - aEvent.clientX * pageZoom;
    let clientToScreenY = aEvent.screenY - aEvent.clientY * pageZoom;

    // TODO: it'd be better to save the image object in the ThumbnailZoomPlus
    // object so we can delete it if we load different image (so it doesn't
    // keep loading in the background).
    image.onerror = function(aEvent) {
      that._logger.debug("In image onerror");
      if (that._currentImage == aImageSrc) {
        that._logger.debug("image onerror: show warning briefly since error loading image (" + aEvent + ")");
        that._showStatusIconBriefly(aImageNode, "warning16.png", 32);      
      }
    };

    image.onload = function() {
      that._imageOnLoad(aImageNode, aImageSrc, 
                             clientToScreenX, clientToScreenY,
                             image)
    };

    this._panelImage.src = aImageSrc;
    image.src = aImageSrc;

    /*
     * In addition to image.onload, set a repeating timer to poll
     * the image.  This lets us display the full-size image as soon
     * as its size is known, even before it's fully loaded, especially
     * important for large images and gifs on a slow connection.
     * The first timer call also causes our working icon to appear.
     */
    this._timer.initWithCallback(
      { notify:
        function() {
            that._checkIfImageLoaded(aImageNode, aImageSrc, 
                             clientToScreenX, clientToScreenY,
                             image);
          }
      }, 0.3 * 1000, Ci.nsITimer.TYPE_REPEATING_SLACK);
  },


  /**
   * Opens the popup positioned appropriately relative to the thumbnail
   * aImageNode.
   */
  _openAndPositionPopup : function(aImageNode, aImageSrc, imageSize, available) {
    // Close and (probably) re-open the panel so we can reposition it to
    // display the image. 
    this._logger.debug("_openAndPositionPopup: hidePopup");
    this._panel.hidePopup();
    this._panelImage.style.backgroundImage = ""; // hide status icon
    
    this._addListenersWhenPopupShown();
    this._setImageSize(aImageSrc, imageSize);
    this._addToHistory(aImageSrc);

    // We prefer above/below thumb to avoid tooltip.
    if (imageSize.height <= available.height) {
      // Position the popup horizontally flush with the right of the window or
      // left-aligned with the left of the thumbnail, whichever is left-most.
      let pageZoom = gBrowser.selectedBrowser.markupDocumentViewer.fullZoom;
      let windowStartX = content.window.mozInnerScreenX * pageZoom;
      let pageWidth = content.window.innerWidth * pageZoom;
      let popupXPageCoords = pageWidth - (imageSize.width + this._widthAddon);
      let popupXScreenCoords = popupXPageCoords + windowStartX;
      let popupXOffset = popupXScreenCoords - this._thumbBBox.xMin;
      this._logger.debug("_openAndPositionPopup: " +
                         "windowStartX=" + windowStartX +
                         "; pageWidth=" + pageWidth +
                         "; popupXPageCoords=" + popupXPageCoords +
                         "; popupXScreenCoords=" + popupXScreenCoords +
                         "; popupXOffset=" + popupXOffset);
      if (popupXOffset > 0) {
        popupXOffset = 0;
      }
      if (imageSize.height <= available.bottom) {
        this._logger.debug("_openAndPositionPopup: display below thumb"); 
        this._panel.openPopup(aImageNode, "after_start", popupXOffset, this._pad, false, false);
      } else {
        this._logger.debug("_openAndPositionPopup: display above thumb"); 
        this._panel.openPopup(aImageNode, "before_start", popupXOffset, -this._pad, false, false);
      }
    } else if (imageSize.width <= available.width) {
      // We prefer left-of thumb over right-of thumb since tooltip
      // typically extends to the right.
      
      // Position the popup vertically flush with the bottom of the window or
      // top-aligned with the top of the thumbnail, whichever is higher.
      // We don't simply use a 0 offset and rely on Firefox's logic since
      // on Windows that can position the thumb under an always-on-top
      // Windows task bar.
      let pageZoom = gBrowser.selectedBrowser.markupDocumentViewer.fullZoom;
      let windowStartY = content.window.mozInnerScreenY * pageZoom;
      let pageHeight = content.window.innerHeight * pageZoom;
      let popupYPageCoords = pageHeight - (imageSize.height + this._widthAddon);
      let popupYScreenCoords = popupYPageCoords + windowStartY;
      let popupYOffset = popupYScreenCoords - this._thumbBBox.yMin;
      this._logger.debug("_openAndPositionPopup: " +
                         "windowStartY=" + windowStartY +
                         "; pageHeight=" + pageHeight +
                         "; popupYPageCoords=" + popupYPageCoords +
                         "; popupYScreenCoords=" + popupYScreenCoords +
                         "; popupYOffset=" + popupYOffset);
      if (popupYOffset > 0) {
        popupYOffset = 0;
      }
      if (imageSize.width <= available.left) {
        this._logger.debug("_openAndPositionPopup: display to left of thumb"); 
        this._panel.openPopup(aImageNode, "start_before", -this._pad, popupYOffset, false, false);
      } else {
        this._logger.debug("_openAndPositionPopup: display to right of thumb"); 
        this._panel.openPopup(aImageNode, "end_before", this._pad, popupYOffset, false, false);
      }
    } else {
      this._logger.debug("_openAndPositionPopup: display in upper-left of window (overlap thumb)"); 
      this._panel.openPopup(null, "overlap", 0, 0, false, false);
    }
  },
  
  
  /**
   * Updates this._thumbBBox to indicate the range of DOM coordinates spanned
   * by the thumb or link.
   */
  _updateThumbBBox : function(aImageNode, xOffset, yOffset) {
    this._logger.trace("_updateThumbBBox");
    			
    let pageZoom = gBrowser.selectedBrowser.markupDocumentViewer.fullZoom;
    var box = aImageNode.getBoundingClientRect();

    this._logger.debug("_updateThumbBBox: x,y offset = " +
                       xOffset + "," + yOffset);

    this._thumbBBox.xMin = xOffset + box.left * pageZoom;
		this._thumbBBox.yMin = yOffset + box.top  * pageZoom;
    
    this._thumbBBox.xMax = this._thumbBBox.xMin + aImageNode.offsetWidth * pageZoom;
    this._thumbBBox.yMax = this._thumbBBox.yMin + aImageNode.offsetHeight * pageZoom;
    
    var viewportElement = gBrowser.selectedBrowser.contentWindow;  
    var scrollLeft = viewportElement.scrollX;
    var scrollTop = viewportElement.scrollY;
    this._thumbBBox.refScrollLeft = scrollLeft;
    this._thumbBBox.refScrollTop = scrollTop;
    this._logger.debug("_updateThumbBBox: tabbed browser = " +gBrowser + "; browser=" + gBrowser.selectedBrowser +
                       "; win=" + gBrowser.selectedBrowser.contentWindow);
    this._logger.debug("_updateThumbBBox: ref scroll = " +
                       scrollLeft + "," + scrollTop);
    
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
   *
   * @param aImageNode the image node.
   * @return An object with .left, .right, .top, .bottom, .width and .height 
   * fields.
   */
  _getAvailableSizeOutsideThumb : function(aImageNode) {
    this._logger.trace("_getAvailableSizeOutsideThumb");
    let pageZoom = gBrowser.selectedBrowser.markupDocumentViewer.fullZoom;
    
    /*
     * pageLeft is the space available to the left of the thumb. 
     * pageTop is the space available above it.
     */
    let available = {};

    available.left = this._thumbBBox.xMin - content.window.mozInnerScreenX * pageZoom;
    available.top = this._thumbBBox.yMin - content.window.mozInnerScreenY * pageZoom;
    
    /*
     * pageRight is the space available to the right of the thumbnail,
     * and pageBottom the space below.
     */
    let pageWidth = content.window.innerWidth * pageZoom;
    let pageHeight = content.window.innerHeight * pageZoom;

    available.right = pageWidth - available.left - aImageNode.offsetWidth * pageZoom;
    available.bottom = pageHeight - available.top - aImageNode.offsetHeight * pageZoom;

    let adjustment = 2*this._pad + this._widthAddon;
    this._logger.debug("_getAvailableSizeOutsideThumb: " +
                       "available.left,right before adjustment = " + 
                       available.left + "," + available.top +
                       "; _pad=" + this._pad + 
                       "; _widthAddon=" + this._widthAddon +
                       "; reducing available by " + adjustment);
    available.left -= adjustment;
    available.right -= adjustment;
    available.top -= adjustment;
    available.bottom -= adjustment;
    
    available.width = Math.max(available.left, available.right);
    available.height = Math.max(available.top, available.bottom);

    return available;
  },


  /**
   * Gets the image scale dimensions to fit the window.
   * @param aImage the image info.
   * @param available: contains (width, height) of the max space available
   * to the left or right and top or bottom of the thumb.
   * @return the scale dimensions in these fields:
   *   {width, height, allow}
   */
  _getScaleDimensions : function(aImage, available, thumbWidth, thumbHeight) {
    this._logger.trace("_getScaleDimensions");

    // When enabled, we allow showing images larger 
    // than would fit entirely to the left or right of
    // the thumbnail by using the full page width
    let pageZoom = gBrowser.selectedBrowser.markupDocumentViewer.fullZoom;
    let pageWidth = content.window.innerWidth * pageZoom - this._widthAddon - 2;
    let pageHeight = content.window.innerHeight * pageZoom - this._widthAddon - 2;
    
    let imageWidth = aImage.width;
    let imageHeight = aImage.height;
    let scaleRatio = (imageWidth / imageHeight);
    let scale = { width: imageWidth, height: imageHeight, allow: true };

    // Make sure scale.width, height is not larger than the window size.
    if (scale.height > pageHeight) {
      scale.height = pageHeight;
      scale.width = scale.height * scaleRatio;
    }
    if (scale.width > pageWidth) {
      scale.width = pageWidth;
      scale.height = scale.width / scaleRatio;
    }

    // Calc sideScale as the biggest size we can use for the image without
    // overlapping the thumb.
    let sideScale = {width: scale.width, height: scale.height, allow: true};
    if (imageHeight > available.height) {
      // Try fitting the image's height to available.height (and scaling
      // width proportionally); this corresponds to showing the
      // popup above or below the thumb.
      sideScale.height = available.height;
      sideScale.width = sideScale.height * scaleRatio;
    }
    if (sideScale.width < available.width) {
      // We can show the image larger by fitting its width to available.width
      // rather than fitting its height; this allows it to appear to
      // the left or right of the thumb.
      sideScale.width = Math.min(available.width, imageWidth);
      sideScale.height = sideScale.width / scaleRatio;
    }
    if (sideScale.height > pageHeight) {
      sideScale.height = pageHeight;
      sideScale.width = scale.height * scaleRatio;
    }
    if (sideScale.width > pageWidth) {
      sideScale.width = pageWidth;
      sideScale.height = sideScale.width / scaleRatio;
    }

    let allowCoverThumb = ThumbnailZoomPlus.Application.prefs.get(this.PREF_PANEL_LARGE_IMAGE);
    allowCoverThumb = allowCoverThumb && allowCoverThumb.value;

    // Check whether to allow popup to cover thumb.
    if (! allowCoverThumb) {
      this._logger.debug("_getScaleDimensions: disallowing covering thumb because of pref");
      scale = sideScale;
    } 

    // Allow showing the popup if popup size is at least 20% bigger
    // than thumb.
    scale.allow = (scale.width >= thumbWidth * 1.20 ||
                   scale.height >= thumbHeight * 1.20);
    sideScale.allow = scale.allow;
    if (! scale.allow) {
        this._logger.debug("_getScaleDimensions: skipping: popup image size (" +
                           scale.width + " x " + scale.height + 
                           ") isn't at least 20% bigger than thumb (" +
                           thumbWidth + " x " + thumbHeight + ")");
    }
    if (scale.allow &&
        scale.width < sideScale.width * 1.20 &&
        sideScale.width > thumbWidth * 1.20) {
      // Disallow covering thumb if it doesn't make the image at least 20%
      // bigger -- but do allow covering even then, if not covering
      // would make the popup less than 20% bigger than the thumb.
      this._logger.debug("_getScaleDimensions: disallowing covering " + 
                         "thumb because covering width " + scale.width +
                         " isn't at least 20% bigger than uncovered width " +
                         sideScale.width);
      scale = sideScale;
    }
    
    scale.width = Math.round(scale.width);
    scale.height = Math.round(scale.height);
    
    return scale;
  },


  /**
   * Shows the image at its full size in the panel.
   * Assumes the popup and image itself are already visible.
   * @param aImageSrc the image source.
   * @param aScale the scale dimmensions.
   */
  _setImageSize : function(aImageSrc, aScale) {
    this._logger.trace("_setImageSize");

    this._logger.debug("_setImageSize: setting size to " +
                       aScale.width + " x " + aScale.height);
    this._panelImage.style.maxWidth = aScale.width + "px";
    this._panelImage.style.minWidth = aScale.width + "px";
    this._panelImage.style.maxHeight = aScale.height + "px";
    this._panelImage.style.minHeight = aScale.height + "px";
  },


  /**
   * Opens the preferences window.
   */
  openPreferences : function() {
    this._logger.debug("openPreferences");

    let optionsDialog =
      window.openDialog("chrome://thumbnailzoomplus/content/options.xul",
        "thumbnailzoomplus-options-window", "chrome,centerscreen");

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
          ThumbnailZoomPlus.DownloadService.downloadImage(
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

    ThumbnailZoomPlus.FilterService.togglePageEnable(aPage);
  },


  /**
   * Updates the pages menu.
   * @param aPage the page constant.
   */
  _updatePagesMenu : function(aPage) {
    this._logger.trace("_updatePagesMenu");

    let pageName = ThumbnailZoomPlus.FilterService.getPageName(aPage);
    let pageEnable = ThumbnailZoomPlus.FilterService.isPageEnabled(aPage);
    let menuItemId = "thumbnailzoomplus-toolbar-menuitem-" + pageName;
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

    let panelBorder = ThumbnailZoomPlus.Application.prefs.get(this.PREF_PANEL_BORDER);

    if (panelBorder && panelBorder.value) {
      this._panel.removeAttribute("panelnoborder");
      this._widthAddon = this._borderWidth * 2;
    } else {
      this._panel.setAttribute("panelnoborder", true);
      this._widthAddon = 0;
    }
  },


  /**
   * Updates the panel opacity based in the preference value.
   */
  _updatePanelOpacity : function() {
    this._logger.trace("_updatePanelOpacity");

    let panelOpacity = ThumbnailZoomPlus.Application.prefs.get(this.PREF_PANEL_OPACITY);

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
        -1 != aData.indexOf(ThumbnailZoomPlus.PrefBranch)) {
      if (-1 != aData.indexOf(".enable")) {
        let page =
          aData.replace(ThumbnailZoomPlus.PrefBranch, "").replace(".enable", "");
        let pageConstant = ThumbnailZoomPlus.FilterService.getPageConstantByName(page);

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
  },
  
  
  _addToHistory : function(url) {
    let allowRecordingHistory = ThumbnailZoomPlus.Application.prefs.get(this.PREF_PANEL_HISTORY);
    if (! allowRecordingHistory || !allowRecordingHistory.value) {
    this._logger.debug("_addToHistory: history pref is off.");  
      return;
    }
    
    // We don't need to check for Private Browsing mode; addURI is automatically
    // ignored in that mode.
    if (url.indexOf(" ") != -1   
        || url.split("?")[0].indexOf("..") != -1) {  
      this._logger.debug("_addToHistory: bad URL syntax");  
      return;  
    }  
    
    this._logger.debug("_addToHistory: '" + url + "'");  
    let ioService = Components.classes["@mozilla.org/network/io-service;1"]  
                          .getService(Components.interfaces.nsIIOService);
    let nsIURI = ioService.newURI(url, null, null);
    
    let historyService2 = Components.classes["@mozilla.org/browser/nav-history-service;1"]
                          .getService(Components.interfaces.nsIGlobalHistory2);  
    
    historyService2.addURI(nsIURI, false, true, null);  
    
  }

};

window.addEventListener(
  "load", function() { ThumbnailZoomPlusChrome.Overlay.init(); }, false);
window.addEventListener(
  "unload", function() { ThumbnailZoomPlusChrome.Overlay.uninit(); }, false);
