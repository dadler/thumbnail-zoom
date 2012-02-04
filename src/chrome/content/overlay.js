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
  PREF_PANEL_ACTIVATE_KEY : ThumbnailZoomPlus.PrefBranch + "panel.key",
  PREF_PANEL_MAX_KEY : ThumbnailZoomPlus.PrefBranch + "panel.maxkey",
  PREF_PANEL_WAIT : ThumbnailZoomPlus.PrefBranch + "panel.wait",
  PREF_PANEL_PARTIAL_LOAD_WAIT: ThumbnailZoomPlus.PrefBranch + "panel.partialloadwait",
  PREF_PANEL_DELAY : ThumbnailZoomPlus.PrefBranch + "panel.delay",
  PREF_PANEL_BORDER : ThumbnailZoomPlus.PrefBranch + "panel.border",
  PREF_PANEL_LARGE_IMAGE : ThumbnailZoomPlus.PrefBranch + "panel.largeimage",
  PREF_PANEL_CAPTION : ThumbnailZoomPlus.PrefBranch + "panel.caption",
  PREF_PANEL_HISTORY : ThumbnailZoomPlus.PrefBranch + "panel.history",
  PREF_PANEL_NEVER_POPDOWN : ThumbnailZoomPlus.PrefBranch + "panel.neverpopdown",
  PREF_PANEL_MAX_ZOOM : ThumbnailZoomPlus.PrefBranch + "panel.maxzoom",
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

  /* The floating panel caption (a label). */
  _panelCaption : null,

  /* Context menu's download image menu item */
  _contextMenu : null,

  /* File Picker. */
  _filePicker : null,
  
  /* The current image source (URL). */
  _currentImage : null,

  // The image object which is currently being loaded (as in new Image ...)
  _imageObjectBeingLoaded : null,
  
  /* The thumb image or link which triggered the current popup */
  _currentThumb : null,

  /* The dimensions of the 1:1 resolution of the popup's image. */
  _origImageWidth : 0,
  _origImageHeight : 0,
  
  /* _thumbBBox is the bounding box of the thumbnail or link which caused
     the popup to launch, in screen coordinates. 
     refScroll{Left,Top} are the window scroll amounts implicit in the bbox
     coords.  If the window might now be scrolled differently, subtract
     these values from the coordinates and add the current window scroll
     (as _insideThumbBBox does). */
  _thumbBBox : { xMin: 999, xMax: -999, yMin: 999, yMax: -999,
                 refScrollLeft: 0, refScrollTop: 0},
                 
  /*
    _ignoreBBox is very similar to _thumbBBox, but it's used as the region
    within which hover events are ignored, to avoid accidentally re-triggering
    the popup when the window regains focus.  Unlike _thumbBBox, 
    _ignoreBBox sometimes gets invalidated, when we no longer need to
    ignore a region.
   */
  _ignoreBBox : { xMin: 999, xMax: -999, yMin: 999, yMax: -999,
                 refScrollLeft: 0, refScrollTop: 0},
                  
  // _borderWidth is the spacing in pixels between the edge of the thumb and the popup.
  _borderWidth : 5, // border itself adds 5 pixels on each edge.
  
  // _widthAddon is additional image width due to border if enabled:
  // 0 or _borderWidth*2.
  _widthAddon : 0,
  
  // _panelWidthAddon is how much wider the entire panel is than the image
  // and its border.
  // Used when calling sizeTo().  Effect may be different on mac than Windows.
  _panelWidthAddon : 10,
  _panelHeightAddon : 0,
  
  // pad is the blank space (in pixels) between the thumbnail and a popup
  // to be shown adjacenetly to it, and between the popup and the window
  // edge.  This is unrelated to the border preference.
  _pad : 5,
  
  // _captionHeight is the additional height of the popup when the caption 
  // is displayed.
  // Set the fist number in this sum the same as thumbnailzoomplus-panel-caption 
  // in overlay.xul
  _captionHeight : 14 + 4,

  _currentMaxScaleBy : 1.0,

  // _maximizingMaxScaleBy is the maximum amount of additional scaling applied
  // when the user requests to view a pop-up maximized.  Constant.
  _maximizingMaxScaleBy : 2.0,

  // _currentWindow is the window from which the current popup was launched.
  // We use this to detect when a different document has been loaded into that
  // window (as opposed to a different window).
  _currentWindow : null,
  
  // _originalURI is the URL _currentWindow (not the image) had when we last 
  // showed the popup.
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
    this._panelCaption = document.getElementById("thumbnailzoomplus-panel-caption");
    this._panelInfo = document.getElementById("thumbnailzoomplus-panel-info");
    this._contextMenu = document.getElementById("thumbnailzoomplus-context-download");

    this._filePicker =
      Cc["@mozilla.org/filepicker;1"].createInstance(Ci.nsIFilePicker);
    this._filePicker.init(window, null, Ci.nsIFilePicker.modeSave);

    this._updatePreferenceFix();
    this._installToolbarButton();
    this._showPanelBorder();
    this._preferencesService.addObserver(this.PREF_PANEL_BORDER, this, false);
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
    this._panelCaption = null;
    this._panelInfo = null;
    this._currentImage = null;
    this._contextMenu = null;
    this._preferencesService.removeObserver(this.PREF_PANEL_BORDER, this);
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
                       doc + " " + content.document.documentURI);
    
    /*
     * Add key listeners so the "Escape" key can hide the popup.
     * We make sure the web site won't see the Escape key by handling
     * all three of keydown, keyup, and keypress; that keeps for example
     * reddpics.com from refreshing the page when we hit Escape.
     * This is only active while the pop-up is displayed.
     */
    doc.addEventListener("keydown", this._handleKeyDown, false);
    doc.addEventListener("keyup", this._handleKeyUp, false);
    doc.addEventListener("keypress", this._handleIgnoreKey, false);
      
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
    doc.removeEventListener("keydown", this._handleKeyDown, false);
    doc.removeEventListener("keyup", this._handleKeyUp, false);
    doc.removeEventListener("keypress", this._handleIgnoreKey, false);
      
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

    this._ignoreBBox.xMax = -999; // don't reject next move as trivial.
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

    this._ignoreBBox.xMax = -999;

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

      // Try to detect if our listeners are already registered, e.g. so we don't
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
        doc.ThumbnailZoomPlus.addedListeners._ignoreBBox.xMin = -99999;
        doc.ThumbnailZoomPlus.addedListeners._ignoreBBox.xMax =  99999;
        doc.ThumbnailZoomPlus.addedListeners._ignoreBBox.yMin = -99999;
        doc.ThumbnailZoomPlus.addedListeners._ignoreBBox.yMax =  99999;
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

    var adj = this._ignoreBBox;
    // Adjust the bounding box to account for scrolling.  Note that the box's
    // position on-screen moves the opposite direction than the scroll amount.
    var xOffset = (adj.refScrollLeft - scrollLeft) * pageZoom; 
    var yOffset = (adj.refScrollTop - scrollTop) * pageZoom;
    adj.xMin += xOffset;
    adj.xMax += xOffset;
    adj.yMin += yOffset;
    adj.yMax += yOffset;

    var inside = (x > adj.xMin &&
                  x < adj.xMax &&
                  y > adj.yMin &&
                  y < adj.yMax);
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
   * _getEffectiveTitle gets the text to be shown in the caption when
   * showing a popupfor aNode.
   *
   * Here are some situations this wants to work in:
   * - image with 'title' text
   * - deviantart.com; Facebook image on wall:
   *   <a> link with title attr, surrounding an img node
   * - reddit textual link associated with image:
   *   <a> link enclosing doc text.
   * - reddit thumb:
   *   <div><p class="title"><a> enclosing doc text, where <div> is a peer of 
   *   the <a> which encloses the <img> of the thumb.
   * - facebook external video embed.:
   *   title is doc text in <div><strong><a> where <div> is a peer of the <a> 
   *   which is the parent of the thumb img.
   * - Google Images popup:
   *   title in doc text in <div class="rg_hx"><p class="..."> or 
   *   <div><p><a>, where <div class="rg_hx"> is a peer
   *   of the <a> which is parent of the img thumb.  There are several <p>
   *   with different classes and IDs, for resolution and orig doc title (rg_hn st), 
   *   image filename (rg_ht), original domain (rg_hr kv), exif data, etc.  
   * - twitpic.com "What's Trending?" images:
   *   alt tag of <img> has tweet text;
   *   <p><a> enclosing text has tweet user, where <p> is peer of <a> enclosing
   *   <img>.
   * - flickr.com:
   *   title is in both <img>'s alt attr and parent <a>'s title attr.
   * - youtube.com:
   *   img is <div><a><span><span><img>, but has a useless alt tag ("Thumbnail").
   *   peer of that <div> is <div><div><h4><a class="title">, which encloses the
   *   doc text title.
   */
  _getEffectiveTitle : function(aNode) {
    // Search ancestors for a node with non-blank textContent.
    let title = "";
    while (aNode != null && aNode.localName.toLowerCase() != "body") {
      if (aNode.title != undefined && 
          aNode.title != "" ) {
        title = aNode.title;
        break;
      }
      let alt = aNode.getAttribute("alt");
      if (alt != undefined && alt != "" &&
          ! /^\s*Thumbnail\s*$/i.test(alt)) {
        // use alt text; useful e.g. with twitpic.  Exclusion for youtube.com.
        this._logger.debug("_getEffectiveTitle: got title from alt: '" +
                           alt + "'");
        title = alt;
        break;
      }

      // Look for document text enclosed by aNode (or its descendents).
      let text = aNode.textContent
      if (text != undefined && text != "") {
        // change newlines to spaces to simplify the next test.
        text = text.replace(/\s+/gm, " ");
        let exp = /^ ?[0-9]+:[0-9]+ ?Add to ?$/m;
        if (exp.test(text) || text == "Add to ") {
          this._logger.debug("_getEffectiveTitle: ignoring youtube element: " +
                             "node=" + aNode + "; textContent='" + text + "'");
        } if (aNode.className == "tagWrapper") {
          // skip Facebook theater image level which just says "Already tagged"
          // so we can traverse up higher.
          this._logger.debug("_getEffectiveTitle: skipping tagWrapper (eg facebook)");
        } else {
          // note: the exclusion test above is for youtube.com.
          title = text;
          this._logger.debug("_getEffectiveTitle: found with className " + aNode.className);
          break;
        }
      }
      this._logger.debug("_getEffectiveTitle: trying parent of " + aNode +
                        ": " + aNode.parentNode);
      aNode = aNode.parentNode;
      if (aNode.localName.toLowerCase() == "ul") {
        // don't traverse up to a "<ul>" since it's likely to
        // contain other links too and we may get the wrong title.
        // Needed e.g. for youtube Spotlight area.
        break;
      }
    }
    this._logger.debug("_getEffectiveTitle: initial title='" + title + 
                       "' from node " + aNode);
    
    // Fix for sites like tumblr which sets title to lots of spaces;
    // also compacts multiples for better display.
    title = title.replace(/\s+/gm, " ");
    title = title.replace(/^ *(.*?) *$/, "$1");
    
    // reddit text ends up having vote counts at the start, e.g.
    // "1294812I'm linking this".  Detect reddit by looking for
    // ")submitted".  Remove the number and "submitted" and what follows.
    title = title.replace(/^[0-9]+(.*\))submitted .*/, "$1");
    
    // youtube fix: extract title from something like
    // 'GFormLLC uploaded 1 day ago 2:20 Add to iPad Survives 100,000+ Foot Fall From Space Near Area 51 (High-Res) http://g-form.com -- G-Form, a company etc.  solely... GFormLLC 629,027 views'
    title = title.replace(/^.* ago [0-9]+:[0-9]+ Add to /, '');
    title = title.replace(/^[0-9]+:[0-9]+ ?Add to /, '');

    if (title == "Already tagged") {
      // Facebook theater photos w/o titles end up as "Already tagged".
      title = "";
    }

    this._logger.debug("_getEffectiveTitle: after compacting='" + title + "'");
    return title;
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
    
    // Mouse entered a different region; clear the previous 'ignore' region
    // so a future mouse move can re-enter it and re-popup.
    this._ignoreBBox.xMax = -999;
    
    if (! this._isKeyActive(this.PREF_PANEL_ACTIVATE_KEY, aEvent)) {
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


  /**
    _tryImageSource tries to display a popup using rule aPage, returning
    true iff aPage's rule matches (in which case it starts a timer to
    make the popup appear later).
    @return true iff it finds a valid site (and thus shows its image).
   */
  _tryImageSource : function(aDocument, pageMatchNode, aEvent, aPage, node) {
    if (! ThumbnailZoomPlus.FilterService.testPageConstantByDoc(pageMatchNode, aPage)) {
      return false;
    }
    
    let imageSourceInfo = ThumbnailZoomPlus.FilterService
                                .getImageSource(aDocument, node, aPage, false);
    let imageSource = imageSourceInfo.imageURL;
    
    if (ThumbnailZoomPlus.FilterService.isPageEnabled(aPage)) {
      if (null != imageSource) {    
        if (! ThumbnailZoomPlus.FilterService.filterImage(imageSource, aPage)) {
          imageSource = null;
        }
      }
      if (null == imageSource &&
          ThumbnailZoomPlus.FilterService.getPageName(aPage) == "others") {
        // Couldn't get image source from link; use the thumb itself as source.
        imageSourceInfo = ThumbnailZoomPlus.FilterService
                                  .getImageSource(aDocument, node, aPage, true);
        imageSource = imageSourceInfo.imageURL;
      }
      if (null != imageSource) {
        // Found a matching page with an image source!
        let zoomImageSrc = ThumbnailZoomPlus.FilterService.getZoomImage(imageSource, aPage);
        if (zoomImageSrc == "") {
          this._logger.debug("_findPageAndShowImage: getZoomImage returned '' (matched but disabled by user).");
        } else if (zoomImageSrc == null) {
          this._logger.debug("_findPageAndShowImage: getZoomImage returned null.");
        } else {
          this._currentWindow = aDocument.defaultView.top;
          this._originalURI = this._currentWindow.document.documentURI;
          this._logger.debug("_findPageAndShowImage: *** Setting _originalURI=" + 
                             this._originalURI);
          
          this._showZoomImage(zoomImageSrc, imageSourceInfo.noTooSmallWarning,
                              node, aPage, aEvent);
          return true;
        }
      }
    }
    return false;
  },


  _findPageAndShowImage : function(aDocument, aEvent, minFullPageNum, node) {
    this._logger.trace("_findPageAndShowImage"); 
    
    let pageZoom = gBrowser.selectedBrowser.markupDocumentViewer.fullZoom;
    let clientToScreenX = aEvent.screenX - aEvent.clientX * pageZoom;
    let clientToScreenY = aEvent.screenY - aEvent.clientY * pageZoom;
    this._thumbBBox = this._calcThumbBBox(node, 
                          clientToScreenX, clientToScreenY);

    /*
     * Try each maching page (rule), starting with the first one,
     * until we find one which can generate an image URL.  We actually
     * try each rule twice -- once matching the page itself and again
     * matching the image.
     *
     * For the page test, we don't test page rules smaller than minFullPageNum,
     * the first matching page determined in onLoad.
     */
    for (var aPage = 0 ; 
         aPage < ThumbnailZoomPlus.FilterService.pageList.length; 
         aPage++) {
    
      if (aPage >= minFullPageNum) {
        this._logger.debug("... _findPageAndShowImage: Trying page  against '" + 
                           ThumbnailZoomPlus.FilterService.pageList[aPage].key +
                           "'");
        
        if (this._tryImageSource(aDocument, aDocument, aEvent, aPage, node)) {
          return;
        }
      }
      this._logger.debug("... _findPageAndShowImage: Trying image against '" + 
                         ThumbnailZoomPlus.FilterService.pageList[aPage].key +
                         "'");
      if (this._tryImageSource(aDocument, node, aEvent, aPage, node)) {
        return;
      }
    }
  },
  
  /**
   * Verifies if the key is active.
   * @param aEvent the event object.
   * @return true if active, false otherwise.
   */
  _isKeyActive : function(prefName, aEvent) {
    this._logger.trace("_isKeyActive");

    let active = false;
    let keyPref = ThumbnailZoomPlus.Application.prefs.get(prefName);
    if (! keyPref) {
      this._logger.debug("_isKeyActive: pref not defined so return true");
      return true;
    }
    switch (keyPref.value) {
      case 1:
        active = aEvent.ctrlKey || 
                 (aEvent.keyCode != undefined && aEvent.keyCode == aEvent.DOM_VK_CONTROL);
        this._logger.debug("_isKeyActive: based on 'control key', return " 
                           + active);
        break;
      case 2:
        active = aEvent.shiftKey || 
                 (aEvent.keyCode != undefined && aEvent.keyCode == aEvent.DOM_VK_SHIFT);
        this._logger.debug("_isKeyActive: based on 'shift key', return " 
                           + active);
        break;
      case 3:
        active = aEvent.altKey || 
                 (aEvent.keyCode != undefined && aEvent.keyCode == aEvent.DOM_VK_ALT);
        this._logger.debug("_isKeyActive: based on 'alt key', return " 
                           + active);
        break;
      default:
        active = true;
        this._logger.debug("_isKeyActive: based on 'None key', return " 
                           + active);
        break;
    }

    return active;
  },


  /**
   * Gets the hover time.
   * @return the hover time, 100 ms by default.
   */
  _getHoverTime : function() {
    this._logger.trace("_getHoverTime");

    let hoverTime = 100;
    let delayPref = ThumbnailZoomPlus.Application.prefs.get(this.PREF_PANEL_WAIT);

    if (delayPref && !isNaN(delayPref.value)) {
      hoverTime = 1000 * delayPref.value;
    }

    return hoverTime;
  },

  /**
   * Gets the hover time in ms.
   * @return the hover time, 100 ms by default.
   */
  _getPartialLoadTime : function() {
    this._logger.trace("_getPartialLoadTime");
    
    let time = 100;
    let delayPref = ThumbnailZoomPlus.Application.prefs.get(this.PREF_PANEL_PARTIAL_LOAD_WAIT);

    if (delayPref && !isNaN(delayPref.value)) {
      time = 1000 * delayPref.value;
    }

    return time;
  },

  // _getCurrentScaleBy returns an additional scale factor beyond 1:1 scale
  // which we'll try to zoom pop-ups to.
  _getCurrentScaleBy : function() {
    this._logger.trace("_getCurrentScaleBy");

    let result = 0.0;
    let pref = ThumbnailZoomPlus.Application.prefs.get(this.PREF_PANEL_MAX_ZOOM);

    if (pref && !isNaN(pref.value)) {
      result = 0.01 * pref.value;
    }

    return result;
  },
 
  _setCurrentScaleBy : function(value) {
    this._logger.trace("_setCurrentScaleBy(" + value + ")");
    value = Math.max(1, value);
    let percent = Math.round(value * 100);
    this._logger.trace("_setCurrentScaleBy: setting pref to '" + percent + "'");
    ThumbnailZoomPlus.Application.prefs.setValue(this.PREF_PANEL_MAX_ZOOM,
                                                 percent);
    return value;
  },

  /**
   * Shows the zoom image panel.
   * @param aImageSrc the image source
   * @param aImageNode the image node
   * @param aPage the page constant
   */
  _showZoomImage : function(zoomImageSrc, noTooSmallWarning, aImageNode, aPage, aEvent) {
    this._logger.trace("_showZoomImage");
    
    // Popping up a new image; reset zoom to the preference value.
    this._currentMaxScaleBy = this._getCurrentScaleBy();

    this._showPanel(aImageNode, zoomImageSrc, noTooSmallWarning, aEvent);
  },


  /*
   * Sets the popup's caption from aImageNode's (or its ancestor's) and
   * clears the title from the node so we don't see a tooltip.
   * TODO: With a hover delay larger than 0.5 seconds, the tooltip appears
   * before this gets called, so it isn't suppressed.
   */
  _setupCaption : function(aImageNode) {
    let allowCaption = ThumbnailZoomPlus.Application.prefs.get(this.PREF_PANEL_CAPTION);
    allowCaption = allowCaption && allowCaption.value;
    this._logger.debug("_setupCaption: caption enabled = " + allowCaption);
    if (!allowCaption) {
      this._hideCaption();
      return;
    }
    
    let caption = this._getEffectiveTitle(aImageNode);
    this._logger.debug("_findPageAndShowImage: image title='" + 
                       caption + "'");
    this._panelCaption.value = caption;
    this._panelCaption.ThumbnailZoomPlusOriginalTitle = aImageNode.title;
    this._panelCaption.ThumbnailZoomPlusOriginalTitleNode = aImageNode;
    aImageNode.title = " "; // suppress tooltip
  },
  
  
  /**
   * Shows the panel.
   * @param aImageNode the image node.
   * @param aImageSrc the image source.
   */
  _showPanel : function(aImageNode, aImageSrc, noTooSmallWarning, aEvent) {
    this._logger.trace("_showPanel");

    this._logger.debug("_showPanel: _closePanel since closing any prev popup before loading new one");

    // Close the panel to ensure that we can popup the new panel at a specified
    // location.  Note that we temporarily save _currentWindow since _closePanel
    // clears it.
    let currentWindow = this._currentWindow;
    this._closePanel();
    this._currentWindow = currentWindow;
    
    this._originalURI = this._currentWindow.document.documentURI;
    this._currentImage = aImageSrc;
    
    this._setupCaption(aImageNode);
    
    // Allow the user to see the context (right-click) menu item for
    // "Save Enlarged Image As...".
    this._contextMenu.hidden = false;
    this._preloadImage(aImageNode, aImageSrc, noTooSmallWarning, aEvent);
  },

  _hideThePopup : function() {
      
    // As a workaround for some linux (eg Gnome3),
    // instead of closing panel, move it to the lower right corner and
    // make it tiny.  Actually we'll do this on all platforms,
    // but then also really close the panel except when
    // ! _allowPopdown (typically on Linux).
    let tiny = {width: 0, height: 0};
    this._setImageSize(tiny);
    this._panel.moveTo(9999, 9999);
    if (! this._allowPopdown()) {      
      return;
    }

    if (this._panel.state != "closed") {
      this._panel.hidePopup();
    }
  },
  
  _hideCaption : function() {
      this._logger.trace("_hideCaption");
      this._panelCaption.hidden = true;
      // restore original title / tooltip:
      if (this._panelCaption.value != "") {
        this._logger.debug("_hideCaption: restoring title to " + 
                           this._panelCaption.ThumbnailZoomPlusOriginalTitleNode
                           + ": " + 
                           this._panelCaption.value);
        if (this._panelCaption.ThumbnailZoomPlusOriginalTitleNode) {
          this._panelCaption.ThumbnailZoomPlusOriginalTitleNode.title = 
                             this._panelCaption.ThumbnailZoomPlusOriginalTitle;
          this._panelCaption.ThumbnailZoomPlusOriginalTitleNode = null;
        }
      }
      this._panelCaption.value = "";
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
      
      this._contextMenu.hidden = true;
      this._timer.cancel();
      this._removeListenersWhenPopupHidden();

      // Clearing _currentWindow prevents a zombie compartment
      // leak (issue #24).
      this._currentWindow = null;

      if (this._imageObjectBeingLoaded) {
        // Make sure if we pop down while trying to load the image, we stop
        // trying to load it and clear out the registered handlers so we
        // don't end up with a Zombie Compartment leak (e.g. when trying
        // to load an image on a non-responsive site).
        this._logger.debug("_closePanel: clearing image onload & onerror\n");
        this._imageObjectBeingLoaded.src = null;
        this._imageObjectBeingLoaded.onload = null;
        this._imageObjectBeingLoaded.onerror = null;
        this._imageObjectBeingLoaded = null;
      }

      this._originalURI = "";
      this._currentImage = null;
      this._hideThePopup();
      
      // We no longer need the image contents, and don't want them to show
      // next time we show the working dialog.  This also helps the garbage 
      // collector:
      this._panelImage.src = null;
      this._panelImage.removeAttribute("src");
      this._currentThumb = null;
      
      this._hideCaption();
    } catch (e) {
      this._logger.debug("_closePanel: EXCEPTION: " + e);
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

    if (x >= this._ignoreBBox.xMin &&
        x <= this._ignoreBBox.xMax &&
        y >= this._ignoreBBox.yMin &&
        y <= this._ignoreBBox.yMax) {
      // Mouse is still over the thumbnail.  Ignore the move and don't
      // dismiss since the thumb would immediately receive an 'over' event
      // and retrigger the popup to display.
      this._logger.debug("_handlePopupMove: ignoring since mouse at " +
                         x + "," + y +
                         " is within thumb " +
                         this._ignoreBBox.xMin + ".." + this._ignoreBBox.xMax + "," +
                         this._ignoreBBox.yMin + ".." + this._ignoreBBox.yMax);
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
  
  _recognizedKey : function(aEvent) {
    return (aEvent.keyCode == aEvent.DOM_VK_EQUALS ||
            aEvent.keyCode == aEvent.DOM_VK_ADD || // for Windows XP
            aEvent.keyCode == aEvent.DOM_VK_SUBTRACT ||
            aEvent.keyCode == aEvent.DOM_VK_P ||
            aEvent.keyCode == aEvent.DOM_VK_C ||
            aEvent.keyCode == aEvent.DOM_VK_0);
  },
  
  _handleKeyDown : function(aEvent) {
    let that = ThumbnailZoomPlusChrome.Overlay;
    that._doHandleKeyDown(aEvent);
  },
  
  _doHandleKeyDown : function(aEvent) {
    this._logger.debug("_handleKeyDown for code "  + aEvent.keyCode );
    
    if (aEvent.keyCode == aEvent.DOM_VK_P) {
      this._logger.debug("_handleKeyUp: openPreferences since pressed p key");
      this.openPreferences();
      
    } else if (aEvent.keyCode == aEvent.DOM_VK_C) {
      let allowCaption = ThumbnailZoomPlus.Application.prefs.get(this.PREF_PANEL_CAPTION);
      allowCaption = allowCaption && allowCaption.value;
      this._logger.debug("_handleKeyUp: toggle caption to " + (! allowCaption) +
                         " since pressed c key");      
      ThumbnailZoomPlus.Application.prefs.setValue(this.PREF_PANEL_CAPTION,
                                                   ! allowCaption);
      // redisplay to update displayed caption.
      if (this._currentThumb) {
        this._setupCaption(this._currentThumb);
      }
      let scale = this._getCurrentScaleBy();
      this._redisplayPopup(scale);
      
    } else if (aEvent.keyCode == aEvent.DOM_VK_T) {
      let tab = gBrowser.addTab(this._currentImage);
      gBrowser.selectedTab = tab;
      
    } else if (aEvent.keyCode == aEvent.DOM_VK_N) {
      window.open(this._currentImage, 
                  "ThumbnailZoomPlusImageWindow",
                  "chrome=no,titlebar=yes,resizable=yes,scrollbars=yes,centerscreen=yes");
      
    } else if (aEvent.keyCode == aEvent.DOM_VK_EQUALS ||
               aEvent.keyCode == aEvent.DOM_VK_ADD || // for Windows XP
               aEvent.keyCode == aEvent.DOM_VK_SUBTRACT) {
      // scale about 2x as fast as Firefox's 1.1, and bigger than the 1.20 
      // checks used to decide if a size is enough larger to be worth covering
      // the thumb.
      let factor = 1.201; 
      if (aEvent.keyCode == aEvent.DOM_VK_SUBTRACT) {
        factor = 1.0 / factor;
      }
      this._currentMaxScaleBy *= factor;
      this._logger.debug("_handleKeyDown: scale *= " +
                         factor + " gives " + this._currentMaxScaleBy);
      this._redisplayPopup(this._currentMaxScaleBy);

    } else if (aEvent.keyCode == aEvent.DOM_VK_0) {
      this._setCurrentScaleBy(1.0);
      this._logger.debug("_handleKeyDown: reset scale = 1.0");
      this._redisplayPopup(1.0);
    } else if (this._isKeyActive(this.PREF_PANEL_MAX_KEY, aEvent)) {
      this._logger.debug("_handleKeyDown: maximize image since max-key is down");
      this._currentMaxScaleBy = Math.max(this._currentMaxScaleBy, this._maximizingMaxScaleBy);
      // negate to indicate to force allowing to cover thumb.
      this._redisplayPopup(-this._currentMaxScaleBy);
    }

    if (this._recognizedKey(aEvent)) {
      this._logger.debug("_handleKeyDown: ignoring key event");
      aEvent.stopPropagation(); // the web page should ignore the key.
      aEvent.preventDefault();
    }
  },
  
  _handleKeyUp : function(aEvent) {
    let that = ThumbnailZoomPlusChrome.Overlay;
    that._logger.debug("_handleKeyUp for code "  + aEvent.keyCode );

    // Handle Escape to cancel popup in key-up.  We couldn't do it in
    // key-down because key-down would then unregister key listeners,
    // and escape key-up would go through to the web page, which we
    // don't want.
    if (aEvent.keyCode == aEvent.DOM_VK_ESCAPE) {
      that._logger.debug("_handleKeyUp: _closePanel since pressed Esc key");
      that._closePanel();
    }
    if (that._recognizedKey(aEvent)) {
      that._logger.debug("_handleKeyUp: ignoring key event");
      aEvent.stopPropagation(); // the web page should ignore the key.
      aEvent.preventDefault();
    }
  },
  
  _handleIgnoreKey : function(aEvent) {
    let that = ThumbnailZoomPlusChrome.Overlay;
    that._logger.debug("_handleIgnoreKey for "  + aEvent.keyCode );
    if (that._recognizedKey(aEvent)) {
      that._logger.debug("_handleIgnoreKey: ignoring key event");
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
    
    this._panelImage.style.backgroundImage =
      "url(\"chrome://thumbnailzoomplus/skin/images/" + iconName + "\")";
    this._panelImage.style.maxWidth = iconWidth + "px";
    this._panelImage.style.minWidth = iconWidth + "px";
    this._panelImage.style.maxHeight = "16px";
    this._panelImage.style.minHeight = "16px";
    this._panelCaption.hidden = true;
    this._panelInfo.hidden = true;
    this._panel.sizeTo(iconWidth + this._widthAddon + this._panelWidthAddon,
                       16 + this._widthAddon + this._panelHeightAddon);

    let x = this._thumbBBox.xMax + this._pad;
    let y = this._thumbBBox.yMin;
    this._logger.debug("_showStatusIcon: showing " + iconName +
                       " at " + x + "," + y + 
                       " size " + iconWidth + ", 16; state=" +
                       this._panel.state);

    if (this._panel.state != "open") {
      this._logger.debug("_showStatusIcon: popping up to show " + iconName);
      this._panel.openPopup(aImageNode, "end_before", this._pad, this._pad, false, false);
    } 
    if (! this._allowPopdown()) {
      // Explicitly position it in case the popup was already displayed,
      // e.g. when ! this._allowPopdown()
      this._panel.moveTo(x, y);
    }
    this._addListenersWhenPopupShown();
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
                                 noTooSmallWarning, image, maxScaleUpBy)
  {
    this._logger.trace("_checkIfImageLoaded");
    if (this._currentImage != aImageSrc) {
      this._logger.debug("_checkIfImageLoaded: ignoring (different window).");
      return;
    }

    // Set to our status icon as a "working" indicator
    // while loading.  This hopefully appears only briefly (or not at all)
    // since we show the full image size as soon as enough of the image is
    // loaded to know its dimensions; but it may appear for a while if the
    // image loads slowly.
    this._logger.debug("_checkIfImageLoaded: showing popup as 'working' indicator.");
    this._showStatusIcon(aImageNode, "working.png", 16);      
    
    if (image.width > 0 && image.height > 0) {
      /*
       * The image has a size so we could technically display it now.  But that
       * often causes it to appear very briefly only half-displayed, with
       * its lower half white.  We try to prevent that by displaying it a bit
       * later, using the timer again.
       */
      this._timer.cancel();
      let that = this;
      let delay = this._getPartialLoadTime();
      if (/\.gif$/.test(aImageSrc)) {
        // Animated gif's can take much longer to load than the time when
        // they could first be dispalyed, so override the user's setting.
        delay = Math.min(delay, 0.5);
      }
      this._logger.debug("_checkIfImageLoaded: calling _imageOnLoad since have size, delayed "
                         + delay + " ms");
      this._timer.initWithCallback(
        { notify:
          function() {
            that._imageOnLoad(aImageNode, aImageSrc, 
                              noTooSmallWarning, image, maxScaleUpBy);
          }
         }, delay, Ci.nsITimer.TYPE_ONE_SHOT);
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
                          noTooSmallWarning, image, maxScaleUpBy)
  {
    this._logger.trace("_imageOnLoad");

    if (this._currentImage != aImageSrc) {
      // A different image than our current one finished loading; ignore it.
      return;
    }

    // This is the image URL we're currently loading (not another previously
    // image we had started loading).

    // Make sure we don't get called again as an onLoad, if current call
    // was due to the timer.
    image.onload = null;
    
    this._timer.cancel();
    
    
    this._currentThumb = aImageNode;
    this._origImageWidth = image.width;
    this._origImageHeight = image.height;
    let displayed =
      this._sizePositionAndDisplayPopup(this._currentThumb, aImageSrc,
                                        noTooSmallWarning, 
                                        this._origImageWidth, this._origImageHeight,
                                        maxScaleUpBy);
    if (displayed) {
      this._addListenersWhenPopupShown();
      this._addToHistory(aImageSrc);
    }
    // Help the garbage collector reclaim memory quickly.
    // (Test by watching "images" size in about:memory.)
    image.src = null;
    image = null;
  },

  _redisplayPopup : function(maxScaleUpBy)
  {
    this._logger.trace("_redisplayPopup");

    if (this._currentThumb != null) {
      // Close the panel to ensure that we can popup the new panel at a specified
      // location. 
      if (this._allowPopdown()) {      
        if (this._panel.state != "closed") {
          this._panel.hidePopup();
        }
      }
      this._sizePositionAndDisplayPopup(this._currentThumb, this._currentImage, true,
                                        this._origImageWidth, this._origImageHeight,
                                        maxScaleUpBy);
    }
  },
  
  _updateForActualScale : function(displayedImageWidth, rawImageWidth)
  /**
    Calculates the actual image scale (actual size / raw image size)
    and sets _currentMaxScaleBy to it and displays it as text overlaid on
    the image.
   */
  {
    let actualScale = displayedImageWidth / rawImageWidth;
    let percent = Math.round(100 * actualScale);

    // Set the actual scale to what we ended up with, so the user won't
    // increase the requested scale beyond what we're able to fit.
    this._currentMaxScaleBy = actualScale;

    if (displayedImageWidth > 60) {
      // Display the actual size % unless it would cover too much of the image.
      this._panelInfo.value = " " + percent + "% ";
      this._panelInfo.hidden = false;
    } else {
      this._panelInfo.hidden = true;
    }
  },
  
  _sizePositionAndDisplayPopup : function(aImageNode, aImageSrc,
                                          noTooSmallWarning, 
                                          imageWidth, imageHeight,
                                          maxScaleUpBy)
  {
    let pageZoom = gBrowser.selectedBrowser.markupDocumentViewer.fullZoom;
    
    this._ignoreBBox.xMin = this._thumbBBox.xMin;
    this._ignoreBBox.xMax = this._thumbBBox.xMax;
    this._ignoreBBox.yMin = this._thumbBBox.yMin;
    this._ignoreBBox.yMax = this._thumbBBox.yMax;
    this._ignoreBBox.refScrollLeft = this._thumbBBox.refScrollLeft;
    this._ignoreBBox.refScrollTop = this._thumbBBox.refScrollTop;
    
    let available = this._getAvailableSizeOutsideThumb(aImageNode);
    let thumbWidth = aImageNode.offsetWidth * pageZoom;
    let thumbHeight = aImageNode.offsetHeight * pageZoom;
    
    // Get the popup image's display size, which is the largest we
    // can display the image (without magnifying it and without it
    // being too big to fit on-screen).
    let imageSize = this._getScaleDimensions(imageWidth, imageHeight, available,
                                             thumbWidth, thumbHeight, maxScaleUpBy);
    
    this._logger.debug("_sizePositionAndDisplayPopup: available w/l/r:" + available.width + 
                       "/" + available.left + 
                       "/" + available.right +
                       "; h/t/b:" + available.height + 
                       "/" + available.top + 
                       "/" + available.bottom + 
                       "; adj windowWidth, Height: " + 
                       available.windowWidth + "," + available.windowHeight);
    this._logger.debug("_sizePositionAndDisplayPopup: " + 
                       "; maxScaleUpBy=" + maxScaleUpBy +
                       "; win width=" + content.window.innerWidth*pageZoom +
                       "; win height=" + content.window.innerHeight*pageZoom +
                       "; full-size image=["+imageWidth + "," + imageHeight + 
                       "]; max imageSize which fits=["+imageSize.width + "," + imageSize.height +"]"); 
    
    if (! imageSize.allow) {
      if (! noTooSmallWarning) {
        this._showStatusIconBriefly(aImageNode, "tooSmall16.png", 32);      
      } else {
        this._logger.debug("_sizePositionAndDisplayPopup: too small (but noTooSmallWarning)");
      }
      
      return false;
    }
    
    this._openAndPositionPopup(aImageNode, aImageSrc, imageSize, available);

    this._updateForActualScale(imageSize.width, imageWidth);
    
    return true;
  },
  
  /**
   * Preloads the image.
   * @param aImageNode the image node.
   * @param aImageSrc the image source.
   * @param aEvent the mouse event which caused us to preload the image.
   */
  _preloadImage : function(aImageNode, aImageSrc, noTooSmallWarning, aEvent) {
    this._logger.trace("_preloadImage");

    let that = this;
    let image = new Image();
    that._imageObjectBeingLoaded = image;
    
    let pageZoom = gBrowser.selectedBrowser.markupDocumentViewer.fullZoom;

    // TODO: it'd be better to save the image object in the ThumbnailZoomPlus
    // object so we can delete it if we load different image (so it doesn't
    // keep loading in the background).
    image.onerror = function(aEvent) {
      that._logger.debug("In image onerror");
      if (that._currentImage == aImageSrc) {
        that._logger.debug("image onerror: show warning briefly since error loading image (" + aEvent + ")");
        that._showStatusIconBriefly(aImageNode, "warning16.png", 32);      
        that._imageObjectBeingLoaded = null;
      }
    };

    let maxScaleUpBy = this._currentMaxScaleBy;
    if (this._isKeyActive(this.PREF_PANEL_MAX_KEY, aEvent)) {
      this._currentMaxScaleBy = Math.max(this._currentMaxScaleBy, this._maximizingMaxScaleBy);
      maxScaleUpBy = -this._currentMaxScaleBy; // negate indicate to force allowing to cover thumb.
    }
    image.onload = function() {
      that._imageOnLoad(aImageNode, aImageSrc, noTooSmallWarning, image, 
                        maxScaleUpBy);
      that._imageObjectBeingLoaded = null;
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
                                     noTooSmallWarning, image, maxScaleUpBy);
          }
      }, 0.3 * 1000, Ci.nsITimer.TYPE_REPEATING_SLACK);
  },

  _allowPopdown : function() {
    let pref = ThumbnailZoomPlus.Application.prefs.get(this.PREF_PANEL_NEVER_POPDOWN);
    if (!pref) {
      return true;
    }
    return ! pref.value;
  },
  
  /**
   * Opens the popup positioned appropriately relative to the thumbnail
   * aImageNode.
   * @param aImageNode: the thumb or link from which we're popping up
   * @param aImageSrc: 
   * @param: imageSize: the size of the image itself as we'll be displaying it
   *                    (i.e. reduced to fit as appropriate)
   * @param: available: the available space in .left, .right, .top, .bottom, 
   *                          .width, .height
   */
  _openAndPositionPopup : function(aImageNode, aImageSrc, imageSize, available) {
    this._logger.trace("_openAndPositionPopup");
    
    let wantCaption = (this._panelCaption.value != "" &&
                       this._panelCaption.value != " ")
    let pos = this._calcPopupPosition(imageSize, wantCaption, available);
    
    this._panelImage.style.backgroundImage = ""; // hide status icon
    
    // Explicitly move panel since if it was already popped-up, openPopupAtScreen
    // won't do anything.
    this._panelCaption.hidden = ! wantCaption;
    this._setImageSize(imageSize);
    this._panel.moveTo(pos.x, pos.y);

    this._panel.openPopupAtScreen(pos.x, pos.y, false);
  },
  
  
  /**
   * Calculates a bounding box like this._thumbBBox or this._ignoreBBox
   * to indicate the range of DOM coordinates spanned by 
   * the thumb or link.  The bounding box is returned
   * as the function result; has no side-effects.
   */
  _calcThumbBBox : function(aImageNode, xOffset, yOffset) {
    this._logger.trace("_calcThumbBBox");
    let result = {};
    
    let pageZoom = gBrowser.selectedBrowser.markupDocumentViewer.fullZoom;
    var box = aImageNode.getBoundingClientRect();

    this._logger.debug("_calcThumbBBox: x,y offset = " +
                       xOffset + "," + yOffset);

    result.xMin = Math.ceil(xOffset + box.left * pageZoom);
		result.yMin = Math.ceil(yOffset + box.top  * pageZoom);
    result.xMax = Math.floor(xOffset + box.right * pageZoom);
    result.yMax = Math.floor(yOffset + box.bottom * pageZoom);
    
    var viewportElement = gBrowser.selectedBrowser.contentWindow;  
    var scrollLeft = viewportElement.scrollX;
    var scrollTop  = viewportElement.scrollY;
    result.refScrollLeft = Math.round(scrollLeft);
    result.refScrollTop = Math.round(scrollTop);
    this._logger.debug("_calcThumbBBox: tabbed browser = " +gBrowser + "; browser=" + gBrowser.selectedBrowser +
                       "; win=" + gBrowser.selectedBrowser.contentWindow);
    this._logger.debug("_calcThumbBBox: ref scroll = " +
                       scrollLeft + "," + scrollTop);
    
    this._logger.debug("_calcThumbBBox: bbox = " +
                       result.xMin + ".." + result.xMax + "," +
                       result.yMin + ".." + result.yMax);
                       
    return result;
  },  
  
  
  /**
   * Returns the width of the larger of the space to the left or
   * right of the thumbnail, and the height of the larger of the space
   * above and below it.  This is the space into which the
   * image would have to fit if we displayed it to the side of or
   * above/below the thumbnail without overlapping it.
   *
   * @param aImageNode the image node.
   * @return An object with .left, .right, .top, .bottom, .windowWidth, and
   *    .windowHeight.  .width and .height are the min of .left, .right and
   *    .top, .bottom, respectively.  All sizes are reduced by padding
   *    so that they reflect possible image size, not entire popup size.
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

    available.windowWidth = pageWidth;
    available.windowHeight = pageHeight;
    available.right = pageWidth - available.left - aImageNode.offsetWidth * pageZoom;
    available.bottom = pageHeight - available.top - aImageNode.offsetHeight * pageZoom;

    let haveCaption = this._panelCaption.value != "" &&
                      this._panelCaption.value != " ";
    let xadjustment = 2*this._pad + this._widthAddon;
    let yadjustment = xadjustment;
    if (haveCaption) {
      yadjustment += this._captionHeight;
    }
        
    this._logger.debug("_getAvailableSizeOutsideThumb: " +
                       "available.left,right before adjustment = " + 
                       available.left + "," + available.right +
                       "; available.top,bottom before adjustment = " + 
                       available.top + "," + available.bottom +
                       "; _pad=" + this._pad + 
                       "; _widthAddon=" + this._widthAddon +
                       "; haveCaption=" + haveCaption + 
                       "; captionHeight=" + this._captionHeight +
                       "; reducing available by " + 
                       xadjustment + "," + yadjustment);
    available.left -= xadjustment;
    available.right -= xadjustment;
    available.top -= yadjustment;
    available.bottom -= yadjustment;
    available.windowWidth -= xadjustment;
    available.windowHeight -= yadjustment;
    
    available.width = Math.max(available.left, available.right);
    available.height = Math.max(available.top, available.bottom);

    available.left = Math.floor(available.left);
    available.right = Math.floor(available.right);
    available.top = Math.floor(available.top);
    available.bottom = Math.floor(available.bottom);
    available.width = Math.floor(available.width);
    available.height = Math.floor(available.height);
    available.windowWidth = Math.floor(available.windowWidth);
    available.windowHeight = Math.floor(available.windowHeight);
    
    return available;
  },

  /**
   * Gets the image scale dimensions to fit the window and whether it should
   *   be allowed to display the popup.
   * @param imageWidth, imageHeight: the dimensions of the full-sized image.
   * @param available: contains (width, height, left, right, top, bottom, 
   *                             windowWidth, windowHeight):
   *   the max space available to the left or right and top or bottom of the thumb.
   * @maxScaleUpBy: the max factor by which to magnify the image; negative
   *   if we should force allowing popup to cover thumb.
   * @return the scale dimensions and position in these fields:
   *   {width: displayed width of image
   *    height: displayed height of image 
   *    allow: boolean; true if we allow the popup; false if disallowed since
   *           would be too small.
   *   }
   */
  _getScaleDimensions : function(imageWidth, imageHeight, available, 
                                 thumbWidth, thumbHeight, maxScaleUpBy) {
    this._logger.trace("_getScaleDimensions");

    // When this.PREF_PANEL_LARGE_IMAGE is enabled, we allow showing images  
    // larger than would fit entirely to the left or right of
    // the thumbnail by using the full page width, covering the thumb.
    let allowCoverThumb = ThumbnailZoomPlus.Application.prefs.
                                              get(this.PREF_PANEL_LARGE_IMAGE);
    allowCoverThumb = allowCoverThumb && allowCoverThumb.value;
    if (maxScaleUpBy < 0.0) {
      // negative maxScaleUpBy means to force allowCoverThumb on.
      allowCoverThumb = true;
      maxScaleUpBy *= -1.;
    }

    let scaleRatio = (imageWidth / imageHeight);
    
    // If the page is zoomed up to greater than 100%, allow the popup to
    // be zoomed up that much too.
    let pageZoom = gBrowser.selectedBrowser.markupDocumentViewer.fullZoom;
    let scaleUpBy = Math.max(1.0, pageZoom);
    scaleUpBy *= maxScaleUpBy;
    let scale = { width: imageWidth * scaleUpBy, 
                  height: imageHeight * scaleUpBy, 
                  allow: true };

    // Calc in 'scale' positioning if we used entire window.
    // Make sure scale.width, height is not larger than the window size.
    if (scale.height > available.windowHeight) {
      // reduce image size to fit page vertically.
      scale.height = available.windowHeight;
      scale.width = scale.height * scaleRatio;
    }
    if (scale.width > available.windowWidth) {
      // reduce image size to fit page horizontally.
      scale.width = available.windowWidth;
      scale.height = scale.width / scaleRatio;
    }
    this._logger.debug("_getScaleDimensions: after w/h limiting, display size = " +
                       scale.width + "x" + scale.height);

    // Calc sideScale as the biggest size we can use for the image without
    // overlapping the thumb.  Start out with large size and reduce to fit.
    let sideScale = {width: scale.width, height: scale.height, allow: true};

    // Now reduce sideScale.width, .height to the largest size which
    // fits in one of above, below, left, or right of thumb.  Note that
    // we don't require it to fit e.g. both left and below thumb; once it
    // fits in one dimension, the other can use the entire window width or height.
    if (sideScale.height > available.height) {
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
      sideScale.width = Math.min(available.width, scale.width);
      sideScale.height = sideScale.width / scaleRatio;
    }

    // Make sure the dimension which isn't being fit to the side of the
    // thumb fits in the entire window size.
    if (sideScale.height > available.windowHeight) {
      sideScale.height = available.windowHeight;
      sideScale.width = scale.height * scaleRatio;
    }
    if (sideScale.width > available.windowWidth) {
      sideScale.width = available.windowWidth;
      sideScale.height = sideScale.width / scaleRatio;
    }

    // 
    // Choose between covering thumb or not, and decide whether to
    //
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
    if (scale.allow && allowCoverThumb &&
        scale.width < sideScale.width * 1.20 &&
        sideScale.width > thumbWidth * 1.20 &&
        maxScaleUpBy <= 1.0) {
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
   * Returns the desired position of the popup, in screen coords, as fields:
   * {x, y}
   */
  _calcPopupPosition : function(imageSize, wantCaption, available) {
    let pos = {};
    let pageZoom = gBrowser.selectedBrowser.markupDocumentViewer.fullZoom;
    let pageWidth = content.window.innerWidth * pageZoom;
    let pageHeight = content.window.innerHeight * pageZoom;
    let windowStartX = content.window.mozInnerScreenX * pageZoom;
    let windowStartY = content.window.mozInnerScreenY * pageZoom;
    this._logger.debug("_calcPopupPosition: pageZoom=" +
                       pageZoom + "; innerHeight=" + 
                       content.window.innerHeight + 
                       "; pageHeight=" + pageHeight);
    let popupWidth = imageSize.width + this._widthAddon;
    let popupHeight = imageSize.height + this._widthAddon;
    if (wantCaption)
      popupHeight += this._captionHeight;

    if (imageSize.height <= available.height) {
      // We prefer above/below thumb to avoid tooltip.
      // Position the popup horizontally flush with the right of the window or
      // left-aligned with the left of the thumbnail, whichever is left-most.
      let popupXPageCoords = pageWidth - (popupWidth + this._pad);
      let popupXScreenCoords = popupXPageCoords + windowStartX;
      if (popupXScreenCoords > this._thumbBBox.xMin) {
        popupXScreenCoords = this._thumbBBox.xMin;
      }
      pos.x = popupXScreenCoords;
      this._logger.debug("_calcPopupPosition: " +
                         "windowStartX=" + windowStartX +
                         "; pageWidth=" + pageWidth +
                         "; popupXPageCoords=" + popupXPageCoords +
                         "; popupXScreenCoords=" + popupXScreenCoords);
      if (imageSize.height <= available.top) {
        this._logger.debug("_calcPopupPosition: display above thumb"); 
        pos.y = this._thumbBBox.yMin - this._pad - popupHeight;
      } else {
        this._logger.debug("_calcPopupPosition: display below thumb"); 
        pos.y = this._thumbBBox.yMax + this._pad;
      }
    } else if (imageSize.width <= available.width) {
      // We prefer left-of thumb to right-of thumb since tooltip
      // typically extends to the right.
      
      // Position the popup vertically flush with the bottom of the window or
      // top-aligned with the top of the thumbnail, whichever is higher.
      // We don't simply use a 0 offset and rely on Firefox's logic since
      // on Windows that can position the thumb under an always-on-top
      // Windows task bar.
      let popupYPageCoords = pageHeight - (popupHeight + this._pad);
      let popupYScreenCoords = popupYPageCoords + windowStartY;
      if (popupYScreenCoords > this._thumbBBox.yMin) {
        popupYScreenCoords = this._thumbBBox.yMin;
      }
      pos.y = popupYScreenCoords;
      this._logger.debug("_calcPopupPosition: " +
                         "windowStartY=" + windowStartY +
                         "; pageHeight=" + pageHeight +
                         "; popupYPageCoords=" + popupYPageCoords +
                         "; popupYScreenCoords=" + popupYScreenCoords);
      if (imageSize.width <= available.left) {
        this._logger.debug("_calcPopupPosition: display to left of thumb"); 
        pos.x = this._thumbBBox.xMin - this._pad - popupWidth;
      } else {
        this._logger.debug("_calcPopupPosition: display to right of thumb"); 
        pos.x = this._thumbBBox.xMax + this._pad;
      }
    } else {
      // cover thumb (at least partially).  Center in window for any dimensions
      // where the thumb will be totally covered.  For any which only parially
      // cover it, allow thumb to be partially visible.

      // First calc centered position:
      pos.x = windowStartX + (available.windowWidth - imageSize.width) / 2;
      pos.y = windowStartY + (available.windowHeight - imageSize.height) / 2;

      this._logger.debug("_calcPopupPosition: " +
                         "overlap thumb.  Centered x,y = " +
                         pos.x + "," + pos.y);

      let openSize = available.windowWidth - imageSize.width;
      this._logger.debug("_calcPopupPosition: " +
                         "available.width = " + available.width +
                         " vs openSize width = " + openSize);
      if (available.left  < openSize ||
          available.right < openSize) {
        // Part of the thumb could be visible horizontally.  Make it so.
        // Typically happens with horizontally-long links, e.g. on reddit.com
        if (available.left < available.right) {
          // There is left free space to the left of the thumb; thus the
          // thumb is closer to the left edge of the window, and
          // we should position against right edge of window
          pos.x = windowStartX + (available.windowWidth - imageSize.width);
          this._logger.debug("_calcPopupPosition: " +
                             "position against right edge of window.  x = " +
                              pos.x);
        } else {
          // position against left edge of window.
          pos.x = windowStartX + this._pad;
          this._logger.debug("_calcPopupPosition: " +
                             "position against left edge of window.  x = " +
                              pos.x);
        }
      }
      
      openSize = available.windowHeight - imageSize.height;
      this._logger.debug("_calcPopupPosition: " +
                         "available.height = " + available.height +
                         " vs openSize height = " + openSize);
      if (available.top  < openSize ||
          available.bottom < openSize) {
        // Part of the thumb could be visible vertically.  Make it so.
        // Typically happens with vertically-long thumbs, e.g. on reddit.com
        if (available.top < available.bottom) {
          // There is left free space to the top of the thumb; thus the
          // thumb is closer to the top edge of the window, and
          // we should position against bottom edge of window
          pos.y = windowStartY + (available.windowHeight - imageSize.height);
          this._logger.debug("_calcPopupPosition: " +
                             "position against bottom edge of window.  y = " +
                              pos.y);
        } else {
          // position against top edge of window.
          pos.y = windowStartY + this._pad;
          this._logger.debug("_calcPopupPosition: " +
                             "position against top edge of window.  y = " +
                              pos.y);
        }
      }
    }
    return pos;
  },
  

  /**
   * Shows the image at its full size in the panel.
   * Assumes the popup and image itself are already visible.
   * @param aScale the scale dimensions.
   */
  _setImageSize : function(aScale) {
    this._logger.trace("_setImageSize");
    this._logger.debug("_setImageSize: setting size to " +
                       aScale.width + " x " + aScale.height);

    this._panelImage.style.maxWidth = aScale.width + "px";
    this._panelImage.style.minWidth = aScale.width + "px";
    this._panelImage.style.maxHeight = aScale.height + "px";
    this._panelImage.style.minHeight = aScale.height + "px";
    this._panelCaption.style.maxWidth = aScale.width + "px";

    // Set the size (redundantly) on the panel itself as a possible workaround
    // for the popup appearing very narrow on Linux:
    if (aScale.width == 0) {
      this._panel.sizeTo(0, 0);
    } else {
      this._panel.sizeTo(aScale.width + this._widthAddon + this._panelWidthAddon, 
                         aScale.height + this._widthAddon + this._panelHeightAddon +
                         (this._panelCaption.hidden ? 0 : this._captionHeight));
    }
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
