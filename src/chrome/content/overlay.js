/**
 * Copyright (c) 2010 Andres Hernandez Monge and 
 * Copyright (c) 2011-2012 David M. Adler
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


// Define these for Seamonkey (they're already defined for Firefox).
var Cc = Components.classes;
var Ci = Components.interfaces;
var Cu = Components.utils;


Cu.import("resource://thumbnailzoomplus/common.js");
Cu.import("resource://thumbnailzoomplus/pages.js");
Cu.import("resource://thumbnailzoomplus/filterService.js");
Cu.import("resource://thumbnailzoomplus/downloadService.js");
Cu.import("resource://thumbnailzoomplus/clipboardService.js");
Cu.import("resource://thumbnailzoomplus/uninstallService.js");
Cu.import("resource://thumbnailzoomplus/siteConfigService.js");

/**
 * Controls the browser overlay.
 */
ThumbnailZoomPlusChrome.Overlay = {
  /* UI preference keys. */
  PREF_PANEL_ACTIVATE_KEY : ThumbnailZoomPlus.PrefBranch + "panel.activatekey",
  PREF_PANEL_ACTIVATE_KEY_ACTIVATES : ThumbnailZoomPlus.PrefBranch + "panel.keydisplay",
  PREF_PANEL_MAX_KEY : ThumbnailZoomPlus.PrefBranch + "panel.maxkey",
  PREF_PANEL_WAIT : ThumbnailZoomPlus.PrefBranch + "panel.wait",
  PREF_PANEL_PARTIAL_LOAD_WAIT: ThumbnailZoomPlus.PrefBranch + "panel.partialloadwait",
  PREF_PANEL_DELAY : ThumbnailZoomPlus.PrefBranch + "panel.delay",
  PREF_PANEL_BORDER : ThumbnailZoomPlus.PrefBranch + "panel.border",
  PREF_PANEL_LARGE_IMAGE : ThumbnailZoomPlus.PrefBranch + "panel.largeimage",
  PREF_PANEL_POPUP_SIZE : ThumbnailZoomPlus.PrefBranch + "panel.popupsize",
  PREF_PANEL_POPUP_ON_SCROLL : ThumbnailZoomPlus.PrefBranch + "panel.popuponscroll",
  PREF_PANEL_FOCUS_POPUP : ThumbnailZoomPlus.PrefBranch + "panel.focuspopup",
  PREF_PANEL_SHOW_PERCENT : ThumbnailZoomPlus.PrefBranch + "panel.showpercent",
  PREF_PANEL_CAPTION : ThumbnailZoomPlus.PrefBranch + "panel.caption",
  PREF_PANEL_HISTORY : ThumbnailZoomPlus.PrefBranch + "panel.history",
  PREF_PANEL_MAX_ZOOM : ThumbnailZoomPlus.PrefBranch + "panel.defaultzoom",
  PREF_PANEL_SAVE_FILENAME : ThumbnailZoomPlus.PrefBranch + "panel.savefilename",
  PREF_PANEL_ENABLE : ThumbnailZoomPlus.PrefBranch + "panel.enable",
  PREF_PANEL_DEBUG : ThumbnailZoomPlus.PrefBranch + "panel.debug",
  PREF_PANEL_HOTKEYS : ThumbnailZoomPlus.PrefBranch + "panel.hotkeys",
  PREF_PANEL_CONTEXT_MENU : ThumbnailZoomPlus.PrefBranch + "panel.contextmenu",

  /* Toolbar button preference key. */
  PREF_TOOLBAR_INSTALLED : ThumbnailZoomPlus.PrefBranch + "button.installed",

  // Values for PREF_PANEL_POPUP_SIZE:
  PREF_VALUE_POPUP_SIZE_WEB_PAGE : "webpage",
  PREF_VALUE_POPUP_SIZE_WINDOW : "window",
  PREF_VALUE_POPUP_SIZE_SCREEN : "screen",

  /* Logger for this object (for debug log file). */
  _logger : null,
  
  /* Preferences service. */
  _preferencesService : null, // TODO: same as ThumbnailZoomPlus.Application.prefs?
  
  // console logging service (Web Developer > Error Console, not debug file)
  _consoleService : null,
  
  /* The timer, which is used:
   *   - for the user-configured delay from when the user hovers until
   *     we start trying to load an image.
   *   - for the repeating timer after we start loading to poll whether we
   *     have loaded enough to know image dimensions and thus show the full-size
   *     image.
   *   - for the cursor to hide the cursor in the popup
   */
  _timer : null,

  /* The floating panel. */
  _panel : null,

  /* The floating panel image.  We use _panelHtmlImage for images except
     *.gif, where we use _panelXulImage to work around issue 
     #77: gif animation restarts when fully loaded.  See explanation
     in overlay.xul. */
  _panelHtmlImage : null,
  _panelXulImage : null,

  /* the <div> parent of _panelHtmlImage; its background is used for the 
     status icons rather than the background of the _panelHtmlImage itself;
     otherwise Firefox's "image still loading" indicator to appear on top
     of the status icon". */
  _panelImageDiv : null,
  
  /* The floating panel caption (a label). */
  _panelCaption : null,

  /* The non-visible text field in the popup for holding keyboard focus. */
  _panelFocusHost : null,

  /* Context menu's download image menu item */
  _contextMenu : null,

  /* File Picker. */
  _filePicker : null,
  
  /* The current image source (URL).  This is used to detect whether
     an event is for the current window's popup, and also for open in new
     tab, open in new window, and save as. */
  _currentImage : null,

  _currentPopupFlags : null,
  
  _galleryImageUrls : null,
  _galleryPosition : 0,
  
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
    ignore a region.  We set _ignoreBBox based on _thumbBBox when we
    pop-down the panel and need to prevent the resulting mouseOver from
    popping it up again, e.g. when closing due to the Escape key.  
    
    We don't set _ignoreBBox when we popup since that causes problems when 
    the bbox we get is wrong due to clipping or when the thumb we popped up from 
    disappears, e.g. when scrolling in Google Images hides Google Images'
    own popup on which we had hovered.
   */
  _ignoreBBox : { xMin: 999, xMax: -999, yMin: 999, yMax: -999,
                 refScrollLeft: 0, refScrollTop: 0},
  
  /**
   * _scrolledSinceMoved is set true when we receive a scroll event and false
   * when we receive a mousemove event.  It is thus true if the last event
   * was a scroll.  We use this to ignore mouseOver events caused by scrolling.
   */
  _scrolledSinceMoved : false,
  
  // _movedSincePoppedUp is set false when popping up and true when mouse is
  // moved over main doc.  We use it to ignore mouseout events resulting from
  // loss of focus from showing the popup.
  _movedSincePoppedUp : false,
  
  // _borderWidth is the spacing in pixels between the edge of the thumb 
  // and the popup when the border is displayed.  This must equal the
  // #thumbnailzoomplus-panel "padding" value in overlay.css.
  // Debugging tip: set large (30) when debugging popup positioning.
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
  // to be shown adjacently to it, and between the popup and the window
  // edge.  This is unrelated to the border preference.
  // Debugging tip: set large (30) when debugging popup positioning.
  _pad : 5,
  
  // _captionHeight is the additional height of the popup when the caption 
  // is displayed.
  // Set the fist number in this sum the same as thumbnailzoomplus-panel-caption 
  // in overlay.xul
  _captionHeight : 14 + 4,

  // _caption is the most recent hovered item's caption text (string).
  // It is available whether or not the 'caption' pref is enabled.
  _caption : "",
  
  // _currentMaxScaleBy is the current image scale factor.  When a popup
  // is displayed, we initialize this based on the defalt zoom preference
  // PREF_PANEL_MAX_ZOOM.  Then we adjust _currentMaxScaleBy (but not
  // the preferences) as the user uses hotkeys to zoom in or out.
  _currentMaxScaleBy : 1.0,

  // _currentAllowCoverThumb is true if the popup is allowed to cover the
  // thumbnail for the current popup.  When a popup is displayed, we initialize
  // this based on preference PREF_PANEL_LARGE_IMAGE.  Its value may
  // be changed during the current popup by pressing the hotkey to
  // maximize popup size or the hotkey to toggle allow-cover-thumb.
  _currentAllowCoverThumb : false,
  
  // _maximizingMaxScaleBy is the maximum amount of additional scaling applied
  // when the user requests to view a pop-up maximized.  Constant.
  _maximizingMaxScaleBy : 2.0,

  // _currentWindow is the window from which the current popup was launched.
  // We use this to detect when a different document has been loaded into that
  // window (as opposed to a different window).
  _currentWindow : null,
  
  // _originalURI is the document URL (not the image) _currentWindow had when we last 
  // showed the popup.
  _originalURI : "",

  // _originalCursorNode (when not null) is the document node whose cursor 
  // attribute we've overridden, and _originalCursor is its original value.
  _originalCursorNode : null,
  _originalCursor : "",

  // Firefox version is the major version of Firefox as an integer, like
  // 3 or 12.
  _firefoxVersion : 0,
  
  // observe is the function called when preferences change (set in init() ).
  observe : null,
  
  /**
   * Initializes the object.
   */
  init : function() {
    this._logger = ThumbnailZoomPlus.getLogger("ThumbnailZoomPlusChrome.Overlay");
    this._logger.debug("init");

    // Get the major firefox version as an integer, e.g. 12.
    var info = Components.classes["@mozilla.org/xre/app-info;1"]  
                  .getService(Components.interfaces.nsIXULAppInfo);
    this._firefoxVersion = 1 * info.version.replace(/^([0-9]+).*/, "$1");
    this._logger.debug("Detected firefox major version " + this._firefoxVersion);

    /*
       Note: the Mozilla add-on validator warns here:
         Deprecated interface in use
         Warning: This add-on uses nsIPrefBranch2, which has been merged into 
         nsIPrefBranch in Gecko 13. Once you drop support for old versions of 
         Gecko, you should stop using nsIPrefBranch2.
         See bug https://bugzilla.mozilla.org/show_bug.cgi?id=718255 for more information.
       This warning can be safely ignored: we still support Firefox 3.x and
       so need the older interface.
     */
    this._preferencesService =
      Cc["@mozilla.org/preferences-service;1"].getService(Ci.nsIPrefBranch2);
    this._consoleService = ThumbnailZoomPlus._consoleService;

    this._timer = Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer);
    this._panel = document.getElementById("thumbnailzoomplus-panel");
    this._borderBox = document.getElementById("thumbnailzoomplus-border-box");
    this._panelHtmlImage = document.getElementById("thumbnailzoomplus-panel-html-image");
    this._panelXulImage = document.getElementById("thumbnailzoomplus-panel-xul-image");
    this._panelImageDiv = document.getElementById("thumbnailzoomplus-panel-image-div");
    this._panelCaption = document.getElementById("thumbnailzoomplus-panel-caption");
    this._panelFocusHost = document.getElementById("thumbnailzoomplus-panel-focus-host");
    this._panelInfo = document.getElementById("thumbnailzoomplus-panel-info");
    this._contextMenu = document.getElementById("thumbnailzoomplus-context-download");
    
    this._contextMenu.hidden = ! ThumbnailZoomPlus.getPref(this.PREF_PANEL_CONTEXT_MENU, true);

    this._filePicker =
      Cc["@mozilla.org/filepicker;1"].createInstance(Ci.nsIFilePicker);
    this._installToolbarButton();
    this._updateMenuButtonState();
    this._showPanelBorder();

    // setup the preferences change observe.  We define a local function which
    // calls this.observePrefChange() to ensure that it gets the same 'this'
    // as us (otherwise it'd get some other 'this' and toolbar menu updates 
    // wouldn't work).
    let that = this;
    this.observe = function(aSubject, aTopic, aData) { 
      that.observePrefChange(aSubject, aTopic, aData);
    }
    this._preferencesService.addObserver(ThumbnailZoomPlus.PrefBranch, this, false);
  
    this._addEventListeners();
  },


  /**
   * Uninitializes the object.
   */
  uninit : function() {
    this._logger.debug("uninit");

    this._panel = null;
    this._panelHtmlImage = null;
    this._panelXulImage = null;
    this._panelImageDiv = null;
    this._panelCaption = null;
    this._panelInfo = null;
    this._currentImage = null;
    this._currentPopupFlags = null;
    this._galleryImageUrls = null;
    this._contextMenu = null;
    this._preferencesService.removeObserver(ThumbnailZoomPlus.PrefBranch, this);
  },

  /**
   * Installs the toolbar button on the first run.
   */
  _installToolbarButton : function() {
    this._logger.trace("_installToolbarButton");

    let buttonInstalled =
      ThumbnailZoomPlus.getPref(this.PREF_TOOLBAR_INSTALLED, false);

    if (!buttonInstalled) {
      let toolbarId =
        (null == document.getElementById("BrowserToolbarPalette") ? "nav-bar": "BrowserToolbarPalette");
      let toolbar = document.getElementById(toolbarId);
      let newCurrentSet = toolbar.currentSet + ",thumbnailzoomplus-toolbar-button";
      toolbar.setAttribute("currentset", newCurrentSet);
      toolbar.currentSet = newCurrentSet;
      document.persist(toolbarId, "currentset");

      try {
        BrowserToolboxCustomizeDone(true);
      } catch (e) { }

      ThumbnailZoomPlus.setPref(this.PREF_TOOLBAR_INSTALLED, true);
    }
  },

  getEntity : function(key) {
    // Gets name from the <XXXENTITYREF ENTITYkey="..."> attribute in overlay.xul
    // if it exists; this is how we get localized names based on locale.dtd entity
    // definitions.
    return document.getElementById("thumbnailzoomplus-entity-names")
                   .getAttribute("ENTITY_" + key);
    
  },
  
  /**
   * Adds the menu items.
   */
  addMenuItems : function() {
    this._logger.trace("addMenuItems");

    if (ThumbnailZoomPlus.logPath) {
      ThumbnailZoomPlus._logToConsole("thumbnailZoomPlus: logging to " + ThumbnailZoomPlus.logPath);
    }

    let menuPopup = document.getElementById("thumbnailzoomplus-toolbar-menu");
    if (menuPopup) {
      let menuSeparator =
        document.getElementById("thumbnailzoomplus-toolbar-menuseparator");
      let menuSeparator2 =
        document.getElementById("thumbnailzoomplus-toolbar-menuseparator2");
      let menuItem = null;
      let pageCount = ThumbnailZoomPlus.FilterService.pageList.length;
      let pageInfo = null;

      for (let i = 0; i < pageCount; i++) {
        pageInfo = ThumbnailZoomPlus.FilterService.pageList[i];
        let name = pageInfo.name;
        if (null == name) {
          continue;
        }
        let id = "thumbnailzoomplus-toolbar-menuitem-" + pageInfo.key;
        menuItem = document.getElementById(id);
        if (menuItem) {
          // I couldn't get Firefox to consistently update the state of
          // existing checkboxes correctly, so instead we always
          // delete and recreate checkboxes when re-showing the menu.
          menuPopup.removeChild(menuItem);
        } 
        // Item doesn't exist so create it.
        menuItem = document.createElement("menuitem");
        menuItem.setAttribute("id", id);
        
        if (name == "") {
          name = this.getEntity("page_" + pageInfo.key);
          ThumbnailZoomPlus.FilterService.pageList[i].name = name;
        }
        menuItem.setAttribute("label", name);
        menuItem.setAttribute("type", "checkbox");
        { 
          let aPage = i;
          menuItem.addEventListener("command",
                                    function() { ThumbnailZoomPlusChrome.Overlay.togglePagePreference(aPage);},
                                    true );
        }
        this._updatePagesMenuItemElement(pageInfo.key, menuItem);
        if (this._isCatchallPage(i)) {
          menuPopup.insertBefore(menuItem, menuSeparator2);
        } else {
          menuPopup.insertBefore(menuItem, menuSeparator);
        }
      }
    }
  },


  /**
   * Adds the event listeners for the window (i.e. for all tabs/documents 
   * in a Firefox window).
   */
  _addEventListeners : function() {
    this._logger.trace("_addEventListeners for document=" + window.document);

    let that = this;

    gBrowser.addEventListener(
      "DOMContentLoaded",
      function(aEvent) { that._handlePageLoaded(aEvent); }, true);
    gBrowser.tabContainer.addEventListener(
      "TabSelect",
      function(aEvent) { that._handleTabSelected(aEvent); }, false);

    // Listen for window activation so we can update the "Add (current site)"
    // button in the preferences dialog.
    window.addEventListener(
      "activate",
      function(aEvent) { that._windowActivated(aEvent); }, false);
      
    // These handlers are on the popup's window, not the document's:
    this._panel.addEventListener(
      "click",
      function(aEvent) {
        that._handlePopupClick(aEvent);
      }, false);
      
    /*
       Note: The Mozilla add-on warns here that:
         Mouse events may cause performance issues.
         Warning: The use of `mousemove`, `mouseover`, and `mouseout` is discouraged. 
         These events are dispatched with high frequency and can cause severe 
         performance issues.
       I think this is not a significant problem for this add-on because
       it's only active over tzp's pop-up window, not over the
       general web browser.
    */
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
    if (false) {
    for (let i=0; i < gBrowser.browsers.length; i++) {
      this._logger.debug("_addEventListeners: " +
                         " adding for pre-existing doc #" + i + ": " + 
                         gBrowser.getBrowserAtIndex(i).contentDocument +
                         " " + gBrowser.getBrowserAtIndex(i).contentDocument.documentURI);
      this._addEventListenersToDoc(gBrowser.getBrowserAtIndex(i).contentDocument);
    }
    }
  },

  _popupTakesFocus : function() {
    if (this._firefoxVersion < 4) {
      // PopupTakesFocus doesn't work in Firefox 3.6 (it doesn't
      // allow keyboard shortcuts to work).
      return false;
    }
    if (! ThumbnailZoomPlus.getPref(this.PREF_PANEL_FOCUS_POPUP, true)) {
      return false;
    }
    return true;
  },
  
  /**
   * _allowPopupTakesFocusForNode returns true iff the popup is allowed
   * to take focus when popuping up for aImageNode (assuming popup takes
   * focus is enabled to begin with).  
   *
   * This lets us disable it in troublesome areas like certain popup
   * menus, where taking focus would cause the site to dismiss the menu
   * and the source of our popup.  If we didn't prevent taking focus
   * we could get into a popup/popdown cycle.
   */
  _allowPopupTakesFocusForNode : function(aImageNode) {
    let nodeClass = aImageNode.className;
    let parent = aImageNode.parentNode || aImageNode;
    let parent2 = parent.parentNode || parent;
    let parent3 = parent2.parentNode || parent2;
    let parent2Class = parent2.className;
    let parent3id = parent3.id;
    this._logger.debug("_allowPopupTakesFocusForNode: aImageNode=" + aImageNode +
                       "; class=" + nodeClass +
                       "; p.class=" + parent.className + 
                       "; p.p.class=" + parent2Class +
                       "; p.p.p.id=" + parent3id);
    if (nodeClass.indexOf("username") >= 0 &&
        /deviantart\.com/.test(this._originalURI)) {
      // This is the deviantart.com Deviants or Groups pulldown menu.
      // Focusing would immediately dismiss the menu so we don't.
      // TODO: it'd be better to detect this more generically if we knew how.
      this._logger.debug("_allowPopupTakesFocusForNode: deviantart; not focusing since p.p.class=" + 
                         parent2Class);
      return false;
    }
    if (aImageNode.className.indexOf("photo") >= 0 &&
        parent3id.indexOf("typeahead_list") >= 0) {
      // Completions menu from Facebook search.
      this._logger.debug("_allowPopupTakesFocusForNode: fb search; not focusing since p.p.p.id=" + 
                         parent3id);
      return false;
    }
    return true;
  },
  
  /**
   * Adds listeners when the popup image is shown.  
   *
   * The listener is added on the popup if _popupTakesFocus()
   * (the default); otherwise it's added to the document itself.
   */
  _addListenersWhenPopupShown : function(aImageNode) {
    this._logger.trace("_addListenersWhenPopupShown");
    
    if (! ThumbnailZoomPlus.getPref(this.PREF_PANEL_HOTKEYS, true)) {
      return;
    }
    
    /*
     * Add key listeners for our hotkeys.
     * We make sure the web site won't see the Escape key by handling
     * all three of keydown, keyup, and keypress; that keeps for example
     * reddpics.com from refreshing the page when we hit Escape.
     * This is only active while the pop-up is displayed.
     * 
     * Note that some compound keys like "?" can appear in keypress but
     * may appear as 0 in keydown.
     *
     * We only do this if the user preference for it is enabled and Firefox
     * is new enough.  Note that this test is independent of the aImageNode
     * test done by _allowPopupTakesFocusForNode(); if that routine causes
     * TZP not to grab focus, we don't want TZP to take keyboard focus at all 
     * since text may be destined for a field like Facebook's Search.
     */
    let useCapture = false;
    if (this._popupTakesFocus()) {
      var keyReceiver = this._panel;
      this._panelFocusHost.addEventListener("blur", this._losingPopupFocus, useCapture);
    } else {
      this._logger.debug("_addListenersWhenPopupShown: this._currentWindow == " + this._currentWindow);
      var keyReceiver = this._currentWindow.document;
    }
    keyReceiver.addEventListener("keydown", this._handleKeyDown, useCapture);
    keyReceiver.addEventListener("keyup", this._handleKeyUp, useCapture);
    keyReceiver.addEventListener("keypress", this._handleKeyPress, useCapture);

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
    that._logger.debug("_removeListenersWhenPopupHidden");
    
    // Unregister for both key receivers in case the PREF_PANEL_FOCUS_POPUP 
    // pref changed while popped up.
    let receivers = [that._panel];
    if (that._currentWindow != null) {
      receivers.push(that._currentWindow.document);
    }
    receivers.forEach(function(keyReceiver) {
        that._logger.debug("_removeListenersWhenPopupHidden: removing from " + keyReceiver);
        keyReceiver.removeEventListener("keydown", that._handleKeyDown, false);
        keyReceiver.removeEventListener("keyup", that._handleKeyUp, false);
        keyReceiver.removeEventListener("keypress", that._handleKeyPress, false);
      }, that);
    
    that._panelFocusHost.removeEventListener("blur", that._losingPopupFocus, false);

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
     * window (where 'that' lives).
     */
    var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
                .getService(Components.interfaces.nsIWindowMediator);
    var browserWindow = wm.getMostRecentWindow("navigator:browser");
    let that = browserWindow.ThumbnailZoomPlusChrome.Overlay;
    this._logger.debug("_handleTabSelected: other win=" + that._currentWindow);
    that._addEventListenersToDoc(gBrowser.contentDocument);

    // don't reject next move as trivial.
    this._clearIgnoreBBox();
    this._debugToConsole("_handleTabSelected: _closePanel(true) since tab selected");
    this._closePanel(true);

    ThumbnailZoomPlus.SiteConfigService.updateSiteInPrefsDialog();
  },
  
  _windowActivated : function(aEvent) {
    ThumbnailZoomPlus.SiteConfigService.updateSiteInPrefsDialog();
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

    if (ThumbnailZoomPlus.logPath) {
      ThumbnailZoomPlus._logToConsole("thumbnailZoomPlus: logging to " + ThumbnailZoomPlus.logPath);
    }
    
    let doc = aEvent.originalTarget;
    this._addEventListenersToDoc(doc);

    if (this._needToPopDown(doc.defaultView)) {
      // Detected that the user loaded a different page into our window, e.g.
      // by clicking a link.  So close the popup.
      this._logger.debug("_handlePageLoaded: *** closing since a page loaded into its host window");

      // A new document has been loaded so we can't access nodes from the
      // previous document anymore.  Clear them to avoid accessing dead
      // data (issue #75).
      this._panelCaption.ThumbnailZoomPlusOriginalTitleNode = null;
      this._originalCursorNode = null;
      this._currentThumb = null;
      
      this._debugToConsole("_handlePageLoaded: _closePanel(true) since page loaded & need to popdown");
      this._closePanel(true);
    }
    
    // If we just switched to a tab and that caused it to load, we didn't
    // know the URL to show in the Preferences dialog's "Add (current site)"
    // button until now.  Update the button.
    ThumbnailZoomPlus.SiteConfigService.updateSiteInPrefsDialog();
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
    this._logger.trace("_addEventListenersToDoc " + doc.documentElement);

    this._clearIgnoreBBox();

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
        // TODO: maybe we could do it using arguments.callee.
        this._logger.debug("_addEventListenersToDoc: A different window has handlers; disabling them."); 
        doc.ThumbnailZoomPlus.addedListeners._ignoreBBox.xMin = -99999;
        doc.ThumbnailZoomPlus.addedListeners._ignoreBBox.xMax =  99999;
        doc.ThumbnailZoomPlus.addedListeners._ignoreBBox.yMin = -99999;
        doc.ThumbnailZoomPlus.addedListeners._ignoreBBox.yMax =  99999;
      }
      
      if (!ThumbnailZoomPlus.SiteConfigService.isURLEnabled(doc.documentURI, false)) {
        this._debugToConsole("<<<>>> Page URL rejected by disabledSitesRE: " + doc.documentURI);
        return;
      }
      this._debugToConsole("Page URL allowed by disabledSitesRE: " + doc.documentURI);

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
        doc.addEventListener(
          "mousemove",
          function(aEvent) {
            that._handleMouseMove(doc, aEvent, pageConstant);
          }, true);
        doc.addEventListener(
          "scroll",
          function(aEvent) {
            that._handleScroll(doc, aEvent, pageConstant);
          }, true);
        // Also listen for mouseout so we can popdown if the user moves
        // the mouse outside the document area without entering another
        // non-thumbnail element.
        doc.addEventListener(
          "mouseout",
          function(aEvent) {
            that._handleMouseOut(doc, aEvent, pageConstant);
          }, true);
      } else {
        this._logger.debug("_addEventListenersToDoc: not on a matching site: " + doc.documentURI);
      }
    } else {
      this._logger.debug("_addEventListenersToDoc: not on an HTML doc: " + doc.documentURI);
    }
  },
  
  _insideThumbBBox : function(bbox, x,y) {
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
    
    if (bbox.xMax == -999) {
      // passed the quick test for "no bbox".
      this._logger.debug("_insideThumbBBox: returning false since _ignoreBBox.xMax == -999");
      return false;
    }

    if (typeof(gBrowser) == "undefined" ||
        typeof(gBrowser.selectedBrowser) == "undefined") {
      // This happens after moving the final remaining tab in a window
      // to a different window, and then hovering an image in the moved tab.
      // I think the problem is taht events are still registered on the <img>
      // sub-documents from the original tab's load.  We work around it by
      // declaring inside the thumb bbox, so the move event will be ignored.
      this._logger.debug("_insideThumbBBox: returning true since no gBrowser");
      return true;
    }
    var viewportElement = gBrowser.selectedBrowser.contentWindow;  
    var scrollLeft = viewportElement.scrollX;
    var scrollTop  = viewportElement.scrollY;

    let pageZoom = gBrowser.selectedBrowser.markupDocumentViewer.fullZoom;

    var adj = {xMin:0, xMax:0, yMin:0, yMax:0};
    // Adjust the bounding box to account for scrolling.  Note that the box's
    // position on-screen moves the opposite direction than the scroll amount.
    var xOffset = (bbox.refScrollLeft - scrollLeft) * pageZoom; 
    var yOffset = (bbox.refScrollTop - scrollTop) * pageZoom;
    adj.xMin = bbox.xMin + xOffset;
    adj.xMax = bbox.xMax + xOffset;
    adj.yMin = bbox.yMin + yOffset;
    adj.yMax = bbox.yMax + yOffset;

    // Testing in use from _handeMouseOut() indicates these tests need
    // to be >=, not > .
    var inside = (x >= adj.xMin &&
                  x <= adj.xMax &&
                  y >= adj.yMin &&
                  y <= adj.yMax);
    if (0) this._logger.debug("_insideThumbBBox: zoom=" + pageZoom + 
                      "; orig scroll=" +
                      bbox.refScrollLeft + "," +
                      bbox.refScrollTop +
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
  
  _getInnerText : function(element) {
    // Based on example by "Alex Blog" at
    // http://ccapeng.blogspot.com/2006/01/firefox-innertext.html
    
    var innerText = "";
    if (element.hasChildNodes()) {
      
      var displayType = window.getComputedStyle(element,null).getPropertyValue("display");
      if (displayType != null && displayType!="none") {
        for (var i = 0; i < element.childNodes.length; i++) {
          if (element.tagName=="P") {
            innerText = "\n" + innerText;
          }
          innerText = innerText + this._getInnerText( element.childNodes[i] );
          // this._logger.debug("_getInnerText: after element " + i +
          //                   " have '" + innerText + "'");
        }
        if (displayType!="inline") innerText = innerText + "\n";
      }
    } else {
      if ( element.nodeType == 3 ) {
        // text
        innerText = innerText + element.nodeValue;
      } else if (element.nodeType == 1) { 
        // object
        var displayType = window.getComputedStyle(element,null).getPropertyValue("display");
        if (displayType == null || displayType=="none") {
        } else if (displayType=="inline") {
          innerText = innerText + element.textContent;
          if (element.tagName=="BR") innerText = innerText + "\n";
        } else {
          innerText = innerText + element.textContent + "\n";
        }
      }
    }
    // this._logger.debug("_getInnerText: returning '" + innerText + "'");
    
    return innerText;
    
  },

  /**
   * _getEffectiveTitle gets the text to be shown in the caption when
   * showing a popup for aNode.
   */
    _getEffectiveTitle : function(aNode) {
      let cls = aNode.className;
      
      this._logger.debug("_getEffectiveTitle: seeking starting node from " +
                         aNode + " class \"" + cls + "\"" + " src " + aNode.getAttribute("src")); 

      let querySelectors = [];

      // We select an alternate starting node instead of aNode for specific
      // situations by setting queryNode to an ancestor node under which to
      // run a CSS selector query, and setting querySelectors to a list of
      // query rules a la http://www.w3.org/TR/CSS2/selector.html.
      // In particular, use .classname and #id.
      // Rules in the array are in priority order, with highest priority
      // first.
      let levelsUp = -1;
      if (/uiPhotoThumb/.test(cls)) {
        this._logger.debug("_getEffectiveTitle: recognized Facebook posted photo in timeline (uiPhotoThumb)");
        levelsUp = 3;
        querySelectors = [".messageBody", ".uiStreamHeadline"];

      } else if (/photoWrap/.test(cls)) {
        this._logger.debug("_getEffectiveTitle: recognized Facebook posted photo in timeline (photoWrap)");
        levelsUp = 4;
        querySelectors = [".messageBody", ".uiStreamHeadline" /* ,".uiStreamPassive"*/ ];

      } else if (/profilePic .* img|-cx-PRIVATE-uiSquareImage.* img/.test(cls)) {
        this._logger.debug("_getEffectiveTitle: recognized Facebook profile photo");
        levelsUp = 2;
        querySelectors = [".passiveName", ".actorName"];
        
      } else if (/title/.test(cls) && "a" == aNode.localName &&
                 /title/.test(aNode.parentNode.className)) {
        this._logger.debug("_getEffectiveTitle: recognized reddit link");
        // go up a level so we include not just the title but also the domain.
        levelsUp = 2;
        querySelectors = [".title"];
      
      } else if (/thumbs.redditmedia.com/.test(aNode.src) &&
                 /thing/.test(aNode.parentNode.parentNode.className)) {
        this._logger.debug("_getEffectiveTitle: recognized reddit thumb");
        levelsUp = 2;
        querySelectors = [".title"];
      
      } else if (/RESImage/.test(cls)) {
        // Reddit with the Reddit Enhancement Suite add-on in "View Images" tab.
        this._logger.debug("_getEffectiveTitle: recognized reddit thumb RESImage");
        levelsUp = 3;
        querySelectors = [".title"];
      
      } else if (aNode.getAttribute("alt") == "Thumbnail" &&
                 /\.ytimg\.com\/.*\/[a-z]+default\.jpg/.test(aNode.getAttribute("src"))) {
        this._logger.debug("_getEffectiveTitle: recognized youtube");
        levelsUp = 6;
        querySelectors = [".title"];
      }
      
      if (levelsUp >= 0) {
        let queryNode = null;
        this._logger.debug("_getEffectiveTitle: selecting parent " + levelsUp +
                           " levels up");
        for (queryNode = aNode; levelsUp > 0 && queryNode; levelsUp--) {
          queryNode = queryNode.parentNode;
        }
        if (queryNode) {
          this._logger.debug("_getEffectiveTitle: selecting beneath " +
                             queryNode + " class \"" + queryNode.className +
                             "\" for CSS selectors " + querySelectors);
          for (var i=0; i < querySelectors.length; i++) {
            let s = querySelectors[i];
            let found = queryNode.querySelector(s);
            if (found) {
              this._logger.debug("_getEffectiveTitle: found node " + 
                                 found + " class \"" + found.className + "\"" +
                                 " using selector \"" + s + "\"");
              aNode = found;
              break;
            }
          }
        }
      }
      return this._getEffectiveTitleForNode(aNode);
    },

  /**
   * _getEffectiveTitleForNode gets the text to be shown in the caption,
   * given a reference node from which to search for caption text.
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
  _getEffectiveTitleForNode : function(aNode) {
    // Search ancestors for a node with non-blank textContent.
    let title = "";
    while (aNode != null && aNode.localName.toLowerCase() != "body") {
      if (aNode.title != undefined && 
          aNode.title != "" ) {
        title = aNode.title;
        this._logger.debug("_getEffectiveTitleForNode: got title from title: '" +
                           title + "'");
        break;
      }
      let alt = aNode.getAttribute("alt");
      if (alt != undefined && alt != "" &&
          ! /^\s*Thumbnail\s*$|^[0-9]+$/i.test(alt)) {
        // use alt text; useful e.g. with twitpic.  
        // Exclusion for youtube.com and sites like 500px.com which just put a 
        // picture number in alt, when an actual title may be available.
        this._logger.debug("_getEffectiveTitleForNode: got title from alt: '" +
                           alt + "'");
        title = alt;
        break;
      }
      // imgur.com uses original-title="title"
      alt = aNode.getAttribute("original-title");
      if (alt != undefined && alt != "") {
        this._logger.debug("_getEffectiveTitleForNode: got title from original-title: '" +
                           alt + "'");
        title = alt;
        break;
      }

      // Look for document text enclosed by aNode (or its descendents).
      let text = this._getInnerText(aNode);
      
      // Remove trailing newlines and spaces:
      text = text.replace(/\s+$/, "");

      if (text != "") {
        // change (repeated) newlines to spaces to simplify the next test.
        text = text.replace(/\s+/gm, " ");
        let exp = /^ ?[0-9]+:[0-9]+ ?Add to ?$/m;
        if (exp.test(text) || text == "Add to ") {
          this._logger.debug("_getEffectiveTitleForNode: ignoring youtube element: " +
                             "node=" + aNode + "; textContent='" + text + "'");
        } if (aNode.className == "tagWrapper") {
          // skip Facebook theater image level which just says "Already tagged"
          // so we can traverse up higher.
          this._logger.debug("_getEffectiveTitleForNode: skipping tagWrapper (eg facebook)");
        } else {
          if (/rg_/.test(aNode.className)) {
            // Special clean-up for Google Images.  EG change
            // from: pizza-page.jpg aiellospizza.com 803 x 704 - Aiello's Pizza - The Taste You Know and Enjoy! Similar - More sizes
            //   to: pizza-page.jpg aiellospizza.com - Aiello's Pizza - The Taste You Know and Enjoy!
            // The - and x are non-ASCII characters.
            this._logger.debug("_getEffectiveTitleForNode: doing Google Images cleanup on '" +
                               text + "'");
            // Note that this isn't a regular "x"; it's a special character, so we use match-anything:
            text = text.replace(/ +[0-9]+ . [0-9]+ /i, "");
            text = text.replace(/ +Similar . More sizes */i, "");
          }
          if (/sg_/.test(aNode.className)) {
            // Specia clean-up for Bing Images.  EG change
            // from: prefer to make my pizza in a 15 inch pizza pan 900 x 602 . 544 kB . jpeg www.perfecthomemadepizza.com More sizes
            //   to: prefer to make my pizza in a 15 inch pizza pan . www.perfecthomemadepizza.com
            // The - and x are non-ASCII characters.
            this._logger.debug("_getEffectiveTitleForNode: doing Bing Images cleanup on '" +
                               text + "'");
            // Note that this isn't a regular "x"; it's a special character, so we use match-anything:
            text = text.replace(/ +[0-9]+ . [0-9]+ . [0-9]+ kB */i, "");
            text = text.replace(/ +(jpeg|gif|png) +/i, " ");
            text = text.replace(/ +More sizes */i, "");
          }

          title = text;
          this._logger.debug("_getEffectiveTitleForNode: found " + aNode + " className \"" +
                             aNode.className + "\"");
          break;
        }
      }
      this._logger.debug("_getEffectiveTitleForNode: trying parent of " + aNode +
                        ": node " + aNode.parentNode + " class \"" + aNode.parentNode.className + "\"");
      aNode = aNode.parentNode;
      if (aNode.localName && aNode.localName.toLowerCase() == "ul") {
        // don't traverse up to a "<ul>" since it's likely to
        // contain other links too and we may get the wrong title.
        // Needed e.g. for youtube Spotlight area.
        break;
      }
    }
    this._logger.debug("_getEffectiveTitleForNode: initial title='" + title + 
                       "' from node " + aNode);
    
    // Fix for sites like tumblr which sets title to lots of spaces;
    // also compacts multiples for better display.
    title = title.replace(/\s+/gm, " ");
    title = title.replace(/^ *(.*?) *$/, "$1");
    
    // reddit text ends up having vote counts at the start, e.g.
    // "1294812I'm linking this".  Detect reddit by looking for
    // ")submitted".  Remove the number and "submitted" and what follows.
    // TODO: may not be needed anymore since we have site-specific logic
    // in _getEffectiveTitle().
    title = title.replace(/^[0-9]+(.*\))submitted .*/, "$1");
    
    // youtube fix: extract title from something like
    // 'GFormLLC uploaded 1 day ago 2:20 Add to iPad Survives http://g-form.com -- G-Form, a company etc.  solely... GFormLLC 629,027 views'
    title = title.replace(/^.* ago [0-9]+:[0-9]+ Add to /, '');
    title = title.replace(/^[0-9]+:[0-9]+ ?Add to /, '');

    if (title == "Already tagged") {
      // Facebook theater photos w/o titles end up as "Already tagged".
      title = "";
    }

    this._logger.debug("_getEffectiveTitleForNode: after compacting='" + title + "'");
    return title;
  },
    
  _handleMouseOut : function (aDocument, aEvent, aPage) {
    
    this._logger.debug("___________________________");
    this._logger.debug("_handleMouseOut leaving " + aEvent.target + 
                       " entering " + aEvent.relatedTarget);
    if (! this._movedSincePoppedUp) {
      this._logger.debug("_handleMouseOut: didn't move since popping up; ignoring.");
      return; 
    }
    
    let x = aEvent.screenX;
    let y = aEvent.screenY;
    if (this._insideThumbBBox(this._ignoreBBox, x, y)) {
      // Ignore attempt to redisplay the same image without first entering
      // a different element, on the assumption that it's caused by a
      // focus change after the popup was dismissed.
      return;
    }

    this._clearIgnoreBBox();
    // this._debugToConsole("_handleMouseOut: _closePanel(false)");
    this._closePanel(false);
  },

  _handleMouseMove : function (aDocument, aEvent, aPage) {
    if (! window.ThumbnailZoomPlusChrome) {
      // I've seen this happen after dragging a tab to a new window.
      return;
    }
    let that = ThumbnailZoomPlusChrome.Overlay;
    that._logger.debug("___________________________");
    that._logger.debug("_handleMouseMove: _scrolledSinceMoved=false");
    that._scrolledSinceMoved = false;
    that._movedSincePoppedUp = true;
  },

  _handleScroll : function (aDocument, aEvent, aPage) {
    if (! window.ThumbnailZoomPlusChrome) {
      // I've seen this happen after dragging a tab to a new window.
      return;
    }
    let that = ThumbnailZoomPlusChrome.Overlay;
    let id = aEvent.target.getAttribute && aEvent.target.getAttribute("id");
    if ("topicBoxCon" == id) {
      // http://Weibo.com uses javascript to horizonally-scroll a list of
      // article links, which causes lots of scroll events and makes it
      // hard to reliably trigger pop-ups.  I don't know how to detect
      // that a scroll event is synthetic so I explicitly ignore scrolls
      // over that area.
      // We normally disable this debug msgs to reduce CPU usage:
      // that._logger.debug("_handleScroll: ignore since target id=" + id);
      return;
    }
    that._logger.debug("___________________________");
    that._logger.debug("_handleScroll: _scrolledSinceMoved=true; " +
      "; target id=" + id);
    that._scrolledSinceMoved = true;
  },

  /**
   * _losingPopupFocus is called when the popup loses keyboard focus.
   * This happens when the user activates a different input field, such
   * as the Location or Find field (by clicking or hotkey).  We
   * close the popup so the user can use that field and so his typing won't
   * be interpreted as TZP hotkeys.
   */
  _losingPopupFocus : function(aEvent) {
    let that = ThumbnailZoomPlusChrome.Overlay;
    that._logger.debug("___________________________");
    that._logger.debug("_losingPopupFocus; closing popup.");

    if (! that._popupTakesFocus()) {
      return;
    }

    // Prevent another popup from immediately happening and taking focus back.
    that._setIgnoreBBoxPageRelative();
    // that._debugToConsole("_losingPopupFocus: _closePanel(false)");
    that._closePanel(false);
  },
  
  /**
   * Handles the mouse over event.
   * @param aEvent the event object.
   * @param aPage the filtered page.
   */
  _handleMouseOver : function (aDocument, aEvent, aPage) {
    let times = 1; // Set to 1 normally, or to 100 when timing.
    
    for (let i = 0; i < times; i++) {
      this._handleMouseOverImpl(aDocument, aEvent, aPage);
    }
  },

  _allowMouseOverPropagation : function(aPage, node) {
    if (aPage == ThumbnailZoomPlus.Pages.Google.aPage &&
        (/^imgthumb|rg_hi/.test(node.id) ||
         node.parentNode && node.parentNode.getAttribute &&
         /uh_rl/.test(node.parentNode.className)) ) {
      // We must prevent mouseOver from getting to the web page for
      // "Visually Related" thumbs in Google since Google's own popup
      // causes endless cycling due to a focus fight (issue #57).
      // thumb id imgthumb10.
      this._logger.debug("_allowMouseOverPropagation: disalowing for " + node);
      return false;
    }
    return true;
  },
  
  _handleMouseOverImpl : function (aDocument, aEvent, aPage) {
      if (! window.ThumbnailZoomPlusChrome) {
        // I've seen this happen after dragging a tab to a new window.
        return;
      }
    
    this._logger.debug("___________________________");
    this._logger.debug("_handleMouseOver");
    
    if (! ThumbnailZoomPlus.getPref(this.PREF_PANEL_ENABLE, true) &&
        ! this._isKeyActive(this.PREF_PANEL_MAX_KEY, false, true, aEvent)) {
      // we're disabled and the maximize key isn't down so refuse to pop-up.
      // we test for this early in the routine to minimize work done when
      // disabled.
      this._logger.debug("_handleMouseOver: ignoring since we're disabled and MAX_KEY isn't down");
      return;
    }    

    if (this._needToPopDown(aDocument.defaultView)) {
      this._debugToConsole("_handleMouseOverImpl: _closePanel(true) since different doc.");
      this._closePanel(true);
      return;
    }
    
    let x = aEvent.screenX;
    let y = aEvent.screenY;
    if (this._insideThumbBBox(this._ignoreBBox, x, y)) {
      // Ignore attempt to redisplay the same image without first entering
      // a different element, on the assumption that it's caused by a
      // focus change after the popup was dismissed.
      return;
    }

    if (x == 0 && y == 0) {
      this._logger.debug("_handleMouseOver: ignoring mouseOver at (0,0), assumed synthetic");
      return;
    }
    
    // Mouse entered a different region; clear the previous 'ignore' region
    // so a future mouse move can re-enter it and re-popup.
    this._clearIgnoreBBox();

    let keyActivates = ThumbnailZoomPlus.getPref(this.PREF_PANEL_ACTIVATE_KEY_ACTIVATES,
                                                 true);
    let keyActive = this._isKeyActive(this.PREF_PANEL_ACTIVATE_KEY, 
                                      !keyActivates, true, aEvent);
    if (! keyActive) {
      // this._debugToConsole("_handleMouseOverImpl: _closePanel(false) since hot key not active");
      this._closePanel(false);
      return;
    }

    // Seen in ff 15:
    // Error: TypeError: can't access dead object
    this._logger.debug("_handleMouseOver: this win=" + this._currentWindow);
    let node = aEvent.target;

    // Close the previously displayed popup (if any).
    // this._debugToConsole("_handleMouseOverImpl: _closePanel(false)");
    this._closePanel(false);

    if (this._scrolledSinceMoved &&
        ! ThumbnailZoomPlus.getPref(this.PREF_PANEL_POPUP_ON_SCROLL, false)) {
      this._logger.debug("_handleMouseOver: _scrolledSinceMoved==true; ignoring");
      return;
    }
    
    if (node == null) {
      this._logger.debug("_handleMouseOver: event.target=null; ignoring");
      return;
    }
    if (node.localName == null) {
      // reported by user on Ubuntu Linux (perhaps node is the document itself?)
      this._logger.debug("_handleMouseOver: event.target.localName=null; ignoring");
      return;
    }
    
    // Start a timer to try to load the image after the configured
    // hover delay time. 
    let that = this;
    this._hideCaption();
    this._timer.cancel();
    this._timer.initWithCallback({ notify:
        function() { that._findPageAndShowImage(aDocument, aEvent, aPage, node); }
      }, this._getHoverTime(), Ci.nsITimer.TYPE_ONE_SHOT);

    if (! this._allowMouseOverPropagation(aPage, node)) {
      aEvent.stopPropagation();
    }
  },

  /**
    _tryImageSource tries to display a popup using rule aPage, returning
    true iff aPage's rule matches (in which case it starts a timer to
    make the popup appear later).
    @return 
            "rejectedPageMatchNode": the page's host URL doesn't match
            "disabled": page's host matches, but is disabled
            "rejectedNode": the thumb/image URL doesn't match imageRegExp 
                            or matches imageDisallowRegExp
            "launched": everything matched and we launched the popup.
            "deferred": the request is deferred (awaiting some event).
                        when it's ready, the function will notify the caller by
                        calling completionGenerator.send(status)
   */
  _tryImageSource : function(aDocument, pageMatchNode, pageMatchHost,
                             aEvent, aPage, node, completionGenerator) {
    var pageName = ThumbnailZoomPlus.FilterService.pageList[aPage].key;
    let requireImageBiggerThanThumb = false;
    let allow = ThumbnailZoomPlus.FilterService.isPageEnabled(aPage);
    if (! allow &&
        (aPage == ThumbnailZoomPlus.Pages.Thumbnail.aPage ||
         aPage == ThumbnailZoomPlus.Pages.ThumbnailItself.aPage) &&
        ThumbnailZoomPlus.FilterService.isPageEnabled(ThumbnailZoomPlus.Pages.Others.aPage)) {
      // This is one of the "thumbnails" pages, this "thumbnails" page is disabled, and
      // the "others" page is enabled.  Allow processing this under the "thumbnails"
      // page, but only if the actual raw image has higher resolution than the
      // thumbnal.  That allows the user to have Others on, Thumbnail off, and
      // still see popups for large images which are embedded as smaller
      // thumbs or images, as happens on tumblr for example.
      allow = true;
      requireImageBiggerThanThumb = true;
    }

    this._logger.debug("... _tryImageSource: Trying " +
                       (aDocument == pageMatchNode ? "page " + aPage + " <" : "<image") +
                       "> against '" + pageName +
                       "'");
    if (! ThumbnailZoomPlus.FilterService.testPageConstantByHost(pageMatchHost, aPage)) {
      return "rejectedPageMatchNode";
    }
    if (! allow) {
      // The rule for aPage is disabled in preferences.
      this._logger.debug("                            DISABLED is page " +
                         pageName );
      return "disabled";
    }
        
    let imageSourceInfo = ThumbnailZoomPlus.FilterService
                                .getImageSource(aDocument, node, aPage);
    let imageSource = imageSourceInfo.imageURL;
    
    // imageSourceNode is the node from which the full-size image's URL
    // is determined.  Node remains the node from which the hover event
    // was provoked.  This distinction is important because:
    // * We want to getZoomImage to use the node from what the URL will be determined
    // * When using a caption, we must clear .title on the event's node
    // * When checking whether the popup's file type is different than the
    //   thumb's, we need the node of the actual thumb, which is more likely
    //   to be the provoking node (since the Others rule typically returns
    //   a parent's <a> node).
    // TODO: ideally we might want to use imageSourceNode for positioning,
    // but still use node for captioning.
    let imageSourceNode = node;
    if (imageSourceInfo.node != null) {
      imageSourceNode = imageSourceInfo.node;
      if (imageSourceNode != node) {
        this._debugToConsole("ThumbnailZoomPlus:    >>> PAGE '" + pageName + "' (" + aPage +
                             "): imageSourceNode: <" +
                           imageSourceNode.localName.toLowerCase() + "> url: \n" +
                           String(imageSourceNode) + " \n" + imageSourceNode.getAttribute("src"));
      }
    }

    if (null == imageSource ||     
        ! ThumbnailZoomPlus.FilterService.filterImage(imageSource, aPage)) {
      this._debugToConsole("ThumbnailZoomPlus:    !!! PAGE '" + pageName + "' (" + aPage +
                            ") imageRegExp or imageDisallowRegExp rejected imageSource \n" +
                           imageSource);

      return "rejectedNode";
    }

    this._debugToConsole("ThumbnailZoomPlus:    !!! PAGE '" + pageName + "' (" + aPage +
                             ") matches imageSource \n" +
                           imageSource);

    // Found a matching page with an image source!
    let flags = new ThumbnailZoomPlus.FilterService.PopupFlags();
    flags.requireImageBiggerThanThumb = requireImageBiggerThanThumb;

    let that = this;
    /*
     * completionFunc is a function which ThumbnailZoomPlus.FilterService
     * .getZoomImage() calls.  It passes in the zoomImageSrc or an array
     * of them and a flag
     * indicating whether it is being called as a deferred callback.
     * It returns a status just like _tryImageSource() returns
     * (except never "deferred").
     *
     * If getZoomImage() can determine the result synchronously, it calls 
     * completionFunc() and that function's result as its own result.
     *
     * Otherwise (when asynchronous) it returns "deferred" immediately
     * (without calling completionFunc) and later asynchronously calls
     * completionFunc.
     *
     * Note that in both cases, completionFunc() is only invoked once per
     * call to getZoomImage().
     */
    let completionFunc = function(zoomImageSrc, calledFromDeferred) {
      return that._getZoomImageCompletion(aDocument, aEvent, aPage, node,
                                   imageSourceNode, 
                                   flags, pageName, completionGenerator,
                                   zoomImageSrc, calledFromDeferred);
    };

    return ThumbnailZoomPlus.FilterService
                      .getZoomImage(imageSource, imageSourceNode, flags, aPage,
                                    completionFunc);
  },

  /**
   * _getZoomImageCompletion is called indirectly when an image source is 
   * determined or determined to be "deferred"; see comments at the end of 
   * _tryImageSource (above) for more details.
   *
   * If calledFromDeferred, it sends status to the completionGenerator.
   */
  _getZoomImageCompletion : function(aDocument, aEvent, aPage, node,
                                     imageSourceNode, 
                                     flags, pageName, completionGenerator,
                                     zoomImageSrc, calledFromDeferred) {

    var status = this._getZoomImageCompletionImmediate
                                  (aDocument, aEvent, aPage, node,
                                   imageSourceNode, 
                                   flags, pageName,
                                   zoomImageSrc);
    if (calledFromDeferred) {
      // Send status to the completionGenerator.
      this._logger.debug("... _getZoomImageCompletion: completionGenerator.send('" + status + "')");
      try {
        completionGenerator.send(status);
      } catch (e if e instanceof StopIteration) {
        // normal completion of generator.
      }
    }
    return status;
  },

  /**
   * _getZoomImageCompletionImmediate determines where a image source was
   * detected, and launches the popup and returns "launched" or
   * returns a reason it isn't valid.
   */
  _getZoomImageCompletionImmediate : function(aDocument, aEvent, aPage, node,
                                              imageSourceNode, 
                                              flags, pageName,
                                              getZoomImageResult) {
    this._debugToConsole("_getZoomImageCompletionImmediate: getZoomImageResult=" + getZoomImageResult +
                         "; type=" + typeof getZoomImageResult);

    if ("[object Array]" == Object.prototype.toString.call(getZoomImageResult)) {
        // Multi-image gallery.
        this._galleryImageUrls = getZoomImageResult;
        this._galleryPosition = 0;
        var zoomImageSrc = getZoomImageResult[0];
        flags.captionPrefix = "1 of " + getZoomImageResult.length + ": ";
        flags.borderColor = "#aaffaa"; // light green
        this._debugToConsole("ThumbnailZoomPlus: page " + pageName + " getZoomImage detected " +  getZoomImageResult.length +
                             " gallery images.");
    } else {
        var zoomImageSrc = getZoomImageResult;
        this._galleryImageUrls = null;
    }
    
    if (zoomImageSrc == "") {
      this._logger.debug("_getZoomImageCompletionImmediate: getZoomImage returned '' (matched but disabled by user).");
      this._debugToConsole("ThumbnailZoomPlus: page " + pageName + " getZoomImage rejected with ''");
      return "rejectedNode";
    }
    if (zoomImageSrc == null) {
      this._logger.debug("_getZoomImageCompletionImmediate: getZoomImage returned null.");
      this._debugToConsole("ThumbnailZoomPlus: page " + pageName + " getZoomImage rejected with null");
      return "rejectedNode";
    }
    if (! this._currentWindow) {
      this._debugToConsole("_getZoomImageCompletionImmediate: ignoring since ! _currentWindow (user moved off thumb?)");
      return "";
    }

    // Test whether the link URL of the hovered-over node is the same as the full-size
    // image we're showing; indicate that clicking the link wouldn't be
    // useful by using our custom cursor on the link/thumb.
    flags.linkSameAsImage = this._isLinkSameAsImage(imageSourceNode, zoomImageSrc);
    flags.imageSourceNode = imageSourceNode;
    
    if (! aDocument.defaultView) {
      // The document doesn't have a window; don't pop-up.  I've seen this
      // happen when an asynchronous pop-up tried to pop-up after the
      // tab was closed.
      this._logger.debug("_getZoomImageCompletionImmediate: no defaultView");
      return "";
    }
    this._originalURI = this._currentWindow.document.documentURI;
    this._logger.debug("_getZoomImageCompletionImmediate: *** Setting _originalURI=" +
                       this._originalURI);

    this._debugToConsole("ThumbnailZoomPlus: >>> page " + pageName + " launching \n" +
                       zoomImageSrc);
    
    this._showZoomImage(zoomImageSrc, flags, node, aEvent);
    return "launched";
  },

  _isCatchallPage : function(aPage) {
    return (aPage == ThumbnailZoomPlus.Pages.Others.aPage ||
            aPage == ThumbnailZoomPlus.Pages.Thumbnail.aPage ||
            aPage == ThumbnailZoomPlus.Pages.ThumbnailItself.aPage ||
            aPage == ThumbnailZoomPlus.Pages.OthersIndirect.aPage);
  },
  
  _findPageAndShowImage : function(aDocument, aEvent, aPage, node) {
    // record the current window now in case we want to show a status icon for it.
    // TODO: I once saw a "Can't access dead object" error here in ff22.0a1 when reloading a page.
    this._currentWindow = aDocument.defaultView.top;
    this._logger.debug("_findPageAndShowImage: setting this._currentWindow = " + this._currentWindow);
    
    let completionGenerator = this._findPageAndShowImageGen(aDocument, aEvent, aPage, node);
    completionGenerator.next(); 
    try {
      // Start the generator by giving it a handle to itself.
      completionGenerator.send(completionGenerator);
    } catch (e if e instanceof StopIteration) {
      // normal completion of generator.
    }
  },

  /**
   * _findPageAndShowImageGen is a generator function which tries page rules
   * until it finds one which matches, and launches the pop-up (if possible).
   * It's a generator so that it can support rules which run asynchronously
   * without blocking the main thread.
   *
   * The initial call doesn't do anything except return a generator object.
   * Then call next() and send(generator) to initialize it; the generator
   * is the return from the _findPageAndShowImageGen function call (the generator itself).
   *
   * That first send() call also causes the function to do all its work,
   * though potentially asynchronously (i.e. after it returns).  A given
   * send() call resumes the function from the point of one of its yield
   * statements.  The function continues to run and try pages until it
   * hits an asynchronous (deferred) page, at which point it does a yield
   * to return to the caller.  When the async function is ready (typically
   * triggered by some other event handler), it'll call the generator's
   * send() method again and the function will resume again from the point
   * of a yield.
   *
   * For info about generators see
   * https://developer.mozilla.org/en/IndexedDB/Using_IndexedDB/Using_JavaScript_Generators_in_Firefox
   * https://developer.mozilla.org/en/Core_JavaScript_1.5_Guide/Iterators_and_Generators#Generators.3a_a_better_way_to_build_Iterators
   * http://matt.bridges.name/archive/54
   */
  _findPageAndShowImageGen : function(aDocument, aEvent, minFullPageNum, node) {
    this._logger.trace("_findPageAndShowImageGen"); 
    
    // Get the completion generator (i.e. ourselves), which the caller 
    // passes into the _findPageAndShowImageGen generator in the first
    // send() call after the first next() call.  We'll call this' yield
    // when we need to run asynchronously; such a yield will be followed
    // sometime later by an asynchronous send() call.
    let completionGenerator = yield undefined;
    
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
     *
     * As a speed optimization, we avoid trying rules we know won't pass.
     * That's important since this routine is called whenever the users moves
     * the mouse pointer into a different element -- even a different paragraph.
     */
    let docHost = ThumbnailZoomPlus.FilterService.getHostOfDoc(aDocument, false);
    let nodeHost = docHost;
    if (aDocument != node) {
      nodeHost = ThumbnailZoomPlus.FilterService.getHostOfDoc(node, true);
    }

    {
      let nodeName = node.localName.toLowerCase();
      let nodeClass = node.className;
      this._debugToConsole("ThumbnailZoomPlus: <<< SEEKING image for " +
                         "name=\"" + nodeName + "\" class=\"" + nodeClass + "\" url=\n"
                         + (node.getAttribute("src") || String(node))
                         + "  pageUrl=" + aDocument.documentURI
                         );
    }
         
    var disallowOthers = false;
    for (var aPage = 0 ; 
         aPage < ThumbnailZoomPlus.FilterService.pageList.length; 
         aPage++) {
      let page = ThumbnailZoomPlus.FilterService.pageList[aPage];
      var pageName = page.key;
      if (disallowOthers && this._isCatchallPage(aPage)) {
        this._logger.debug("_findPageAndShowImageGen: Skipping catch-all page " + 
                           aPage + " " + pageName);
        continue;
      }
      
      let status="notTried";
      if (aPage >= minFullPageNum && docHost != null) {
        status = this._tryImageSource(aDocument, aDocument, docHost, aEvent, aPage, node, completionGenerator);
        if (status == "deferred") {
          this._debugToConsole("ThumbnailZoomPlus: ... deferred by page " + pageName);
          this._showStatusIcon(node, "working-2dots.png", 16, null);      
          status = yield undefined;
          this._debugToConsole("ThumbnailZoomPlus: ... resumed");
        }
        this._logger.debug("_findPageAndShowImageGen: got status " + status);

        if (status == "disabled" && 
            ! this._isCatchallPage(aPage) &&
            page.host.source != ".*") {
          /*
           * If the host matches the page's host URL but the page is disabled,
           * then don't allow a popup due to the match-all pages
           * Others and Thumbnails.  The user means to disable the page so
           * we don't want to show popups from Others and Thumbnails.  But
           * if any other page happens to match host, we'll still allow that
           * other page to launch a popup.
           *
           * We exlude this logic when host is match-all since that would disable
           * on all sites, which we don't want.
           */
          disallowOthers = true;
          this._logger.debug("_findPageAndShowImageGen: Disabling Others & Thumbnails since " +
                             page.key +
                             " is disabled");
        }
      }
      
      if ((status == "notTried" || status == "rejectedPageMatchNode") &&
          nodeHost != null && nodeHost != docHost) {
        // The try above failed due to rejecting aDocument as the pageMatchNode.
        // Try again using the thumb itself as pageMatchNode
        status = this._tryImageSource(aDocument, node, nodeHost, aEvent, aPage, node, completionGenerator);
        if (status == "deferred") {
          this._debugToConsole("ThumbnailZoomPlus: ... deferred by page " + pageName);
          status = yield undefined;
          this._showStatusIcon(node, "working-2dots.png", 16, null);      
          this._debugToConsole("ThumbnailZoomPlus: ... resumed");
        }
        this._logger.debug("_findPageAndShowImageGen: got status " + status);
      }

      if (status == "launched") {
        completionGenerator = null;
        return;
      }
    }
    this._debugToConsole("ThumbnailZoomPlus: >>> all pages rejected");
    completionGenerator = null;
    
    // Close the "working" indicator (eg shown if there was a deferred page). 
    this._closePanel(false);
  },
  
  /**
   * Verifies if the key is active.
   * @param prefName: the preference which determines which modifier key we look for
   * @param negate: if true, negates the logic of the test, returning true
   *                iff the key is *not* down (but does not have an effect if no
   *                key is configured).
   * @param useState: if true, looks not just at the key of the current event,
   *                  but also the modifier state based on prior events.
   * @param aEvent the event object.
   * @return true if active, false otherwise.
   */
  _isKeyActive : function(prefName, negate, useState, aEvent) {
    this._logger.trace("_isKeyActive");

    let active = false;
    let keyPref = ThumbnailZoomPlus.getPref(prefName, 2);
    switch (keyPref) {
      case 1:
        active = (useState && aEvent.ctrlKey) || 
                 (aEvent.keyCode != undefined && aEvent.keyCode == aEvent.DOM_VK_CONTROL);
        active = active ^ negate;
        this._logger.debug("_isKeyActive: based on 'control key', return " 
                           + active);
        break;
      case 2:
        active = (useState && aEvent.shiftKey) || 
                 (aEvent.keyCode != undefined && aEvent.keyCode == aEvent.DOM_VK_SHIFT);
        active = active ^ negate;
        this._logger.debug("_isKeyActive: based on 'shift key', return " 
                           + active);
        break;
      case 3:
        active = (useState && aEvent.altKey) || 
                 (aEvent.keyCode != undefined && aEvent.keyCode == aEvent.DOM_VK_ALT);
        active = active ^ negate;
        this._logger.debug("_isKeyActive: based on 'alt key', return " 
                           + active);
        break;
      default:
        // none; 'negate' flag does not apply.
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
    let delayPref = ThumbnailZoomPlus.getPref(this.PREF_PANEL_WAIT, 0.1);

    if (!isNaN(delayPref)) {
      hoverTime = 1000 * delayPref;
    }

    return hoverTime;
  },

  /**
   * Gets the hover time in ms.
   * @return the hover time, 100 ms by default.
   */
  _getPartialLoadTime : function() {
    this._logger.trace("_getPartialLoadTime");
    
    let time = 1000;
    let delayPref = ThumbnailZoomPlus.getPref(this.PREF_PANEL_PARTIAL_LOAD_WAIT, 1.0);

    if (!isNaN(delayPref)) {
      time = 1000 * delayPref;
    }

    return time;
  },

  // _getDefaultScalePref returns an additional scale factor beyond 1:1 scale
  // which we'll try to zoom pop-ups to.
  _getDefaultScalePref : function() {
    this._logger.trace("_getDefaultScalePref");

    let result = 0.0;
    let value = ThumbnailZoomPlus.getPref(this.PREF_PANEL_MAX_ZOOM, 2.0);

    if (!isNaN(value)) {
      result = 0.01 * value;
      // min 1% zoom.
      result = Math.max(0.01, result);
    }

    return result;
  },
 
  _setDefaultScalePref : function(value) {
    this._logger.trace("_setDefaultScalePref(" + value + ")");
    let percent = Math.round(value * 100);
    this._logger.trace("_setDefaultScalePref: setting pref to '" + percent + "'");
    ThumbnailZoomPlus.setPref(this.PREF_PANEL_MAX_ZOOM, percent);
    return value;
  },

  _getAllowCoverThumbPref : function() {
      return ThumbnailZoomPlus.getPref(this.PREF_PANEL_LARGE_IMAGE, false);
  },

  /**
   * Shows the zoom image panel.
   * @param aImageSrc the image source
   * @param aImageNode the image node
   */
  _showZoomImage : function(zoomImageSrc, flags, aImageNode, 
                            aEvent) {
    this._logger.trace("_showZoomImage");
    
    // Popping up a new image; reset zoom to the preference value.
    this._currentMaxScaleBy = this._getDefaultScalePref();
    this._currentAllowCoverThumb = this._getAllowCoverThumbPref();
    
    this._showPanel(aImageNode, zoomImageSrc, 
                    flags, aEvent);
  },


  /*
   * Sets the popup's caption from aImageNode's (or its ancestor's)
   * and clears the tooltip.
   * Be sure to call _hideCaption() at some point in the future so the 
   * original tooltip/title gets restored to the node.
   *
   * TODO: With a hover delay larger than 0.5 seconds, the tooltip appears
   * before this gets called, so it isn't suppressed.
   */
  _setupCaption : function(aImageNode, captionPrefix) {
    let allowCaption = ThumbnailZoomPlus.getPref(this.PREF_PANEL_CAPTION, true);
    this._logger.debug("_setupCaption: caption enabled = " + allowCaption);
    this._hideCaption();
    
    this._caption = captionPrefix + this._getEffectiveTitle(aImageNode);
    this._logger.debug("_setupCaption: image title='" + 
                       this._caption + "'");
    if (!allowCaption) {
      return;
    }
    this._panelCaption.value = this._caption;
    this._panelCaption.ThumbnailZoomPlusOriginalTitleNode = aImageNode;
    this._panelCaption.ThumbnailZoomPlusOriginalTitle = aImageNode.title;

    // suppress the tooltip from the thumb.
    aImageNode.title = " ";
  },
  
  /**
   * _hideCaption hides the caption from the popup and restores the original
   * tooltip to the original node.  We call this when closing the popup
   * and even if we just have an error loading the image, since we need
   * to restore the original tooltip.
   *
   * It doesn't do anything if there is no saved tooltip to restore
   * so calling it extra doesn't hurt.
   */
  _hideCaption : function() {
      this._logger.trace("_hideCaption");
      // restore original title / tooltip:
      if (this._panelCaption) {
        let titleNode = null;
        let titleNodeName = "?";
        if (this._panelCaption.value != "") {
          this._panelCaption.hidden = true;
          // Try to get in titleNode the element node which the title came
          // from, so we can restore its tooltip.  But this may throw
          // TypeError, e.g. if the user reload the page while a popup was
          // displayed, so catch and ignore that situation (prevents
          // problem in firefox 15).
          try {
            titleNode = this._panelCaption.ThumbnailZoomPlusOriginalTitleNode;
            titleNodeName = String(titleNode);
          } catch (e) {
            titleNode = null;
          }
        }        
        if (titleNode) {
          this._logger.debug("_hideCaption: restoring title of " + 
                             titleNodeName
                             + ": " + 
                             this._panelCaption.value);
          titleNode.title = this._panelCaption.ThumbnailZoomPlusOriginalTitle;
        }
        this._panelCaption.ThumbnailZoomPlusOriginalTitleNode = null;
        this._panelCaption.value = "";
      }
  },
  
  _setupCursor : function(aImageNode) {
    this._logger.trace("_setupCursor");

    // In case an override was already in effect, clear it.
    this._restoreCursor();

    this._originalCursor = aImageNode.style.cursor;
    this._originalCursorNode = aImageNode;

    // Use our custom cursor, except in Firefox 3.6 where we'll fallback to 
    // crosshair (some fallback is required to be specified).
    aImageNode.style.cursor = "url(chrome://thumbnailzoomplus/skin/images/tzp-cursor.gif),crosshair";
  },
  
  _restoreCursor : function() {
      this._logger.trace("_restoreCursor");

      if (this._originalCursorNode) {
        try {
          var nodeName = String(this._originalCursorNode);
        } catch (e) {
          // In Firefox 15 and newer, converting this._originalCursorNode to
          // String can throw "TypeError: can't access dead object" (e.g.
          // when reloading while working cursor is displayed).  So we
          // trap and ignore that.
          this._originalCursorNode = null;
          return;
        }
        this._logger.debug("_restoreCursor: restoring cursor to " + 
                           this._originalCursorNode
                           + ": " + this._originalCursor);
        this._originalCursorNode.style.cursor = this._originalCursor;
        this._originalCursorNode = null;
      }
  },
  
  _showPopupCursor : function() {
    // Enable cursor.
    if (this._originalCursorNode) {
      this._panel.style.cursor = "url(chrome://thumbnailzoomplus/skin/images/tzp-cursor.gif),auto";
    } else {
      this._panel.style.cursor = "auto";
    }
    
    // Set a timer to disable cursor soon, so we only see it when moving 
    // the mouse.
    this._timer.cancel();
    let that = this;
    this._timer.initWithCallback(
      { notify:
        function() {
          /*
             Hide the cursor over the popup.
             
     We want to set cursor: none, but due to a bug seen in Firefox 11 on Mac,
     the cursor sometimes gets stuck invisible after popdown.  As a workaround,
     instead of using none, we set cursor to a transparent image.
     Problem seen on the 4th image (which sets a non-default cursor)
     on the Reddit framing of this imgur page:
     http://www.reddit.com/tb/rd0b1
     http://imgur.com/a/21WOk
     
     Possibly related bug report:
     https://bugzilla.mozilla.org/show_bug.cgi?id=721239
            */
            let cursor = "url(chrome://thumbnailzoomplus/skin/images/transparent_1x1.gif), auto";
            that._panel.style.cursor = cursor;
        }
      }, 0.5 * 1000, Ci.nsITimer.TYPE_ONE_SHOT);
  },
  
    /**
    _isLinkSameAsImage returns true iff the specified node links to the
    same url as zoomImageSrc (a string).  This determines whether we show
    a special cursor.
  */
  _isLinkSameAsImage : function(imageSourceNode, zoomImageSrc) {
    this._logger.debug("_isLinkSameAsImage(\"" + imageSourceNode + 
                       "\", \"" + zoomImageSrc + "\"");
    if (String(imageSourceNode) != zoomImageSrc) {
      this._logger.debug("_isLinkSameAsImage(\"" + imageSourceNode + 
                       "\"): false since != \"" + zoomImageSrc + "\"");
      return false;
    }

    var handler = null;
    try {
      handler = imageSourceNode.onmousedown || imageSourceNode.onclick;
    } catch (e) {
      // Ignore the "Component is not available" exception we get in Firefix 3.6.
      ThumbnailZoomPlus._logExceptionToConsole("_isLinkSameAsImage: note:", e);
    }
    
    if (handler) {
      handler = String(handler);
      if (! handler.match(/lightbox|save_href\(/i)) {
        // If there's a javascript handler, clicking the link may do something
        // different than our popup shows so don't use the special cursor.
        // But we specifically ignore handlers for lightboxes like on
        // tumblr.com and reddit's link redirector (save_href).
        this._logger.debug("_isLinkSameAsImage(\"" + imageSourceNode + 
                           "\"): false due to onmousedown or onclick: \"" +
                         handler + "\"");
        return false;
      }
      this._logger.debug("_isLinkSameAsImage(\"" + imageSourceNode + 
                           "\"): ignoring onmousedown or onclick which " +
                           "we want to ignore: \"" +
                           handler + "\"");
    }
    this._logger.debug("_isLinkSameAsImage(\"" + imageSourceNode + 
                       "\"): true");
    return true;
  },

  _setCursorAndBorderColor : function(aImageNode, flags) {
    if (! flags) {
      this._borderBox.style.backgroundColor = "white";
      return;
    } 
    if (flags.linkSameAsImage) {
      this._setupCursor(aImageNode);
      this._borderBox.style.backgroundColor = "white";
    } else {
      // Color the border to indicate that the link is more than just the image.  
      this._borderBox.style.backgroundColor = "#33ccff"; // light blue
    }
    if (flags.borderColor != null) {
      this._borderBox.style.backgroundColor = flags.borderColor;
    }
  },
  
  /**
   * Shows the panel (after the image has loaded).
   * @param aImageNode the image node.
   * @param aImageSrc the image source.
   */
  _showPanel : function(aImageNode, aImageSrc, flags, aEvent) {
    this._logger.trace("_showPanel");

    this._originalURI = this._currentWindow.document.documentURI;
    this._currentImage = aImageSrc;
    this._currentPopupFlags = flags;
    
    this._setupCaption(aImageNode, flags.captionPrefix);
    this._setCursorAndBorderColor(aImageNode, flags);
    
    // Allow the user to use the context (right-click) menu item for
    // "Save Full-size Image As...".
    this._contextMenu.disabled = false;
    this._panelInfo.hidden = true;

    this._preloadImage(aImageNode, aImageSrc, 
                       flags, aEvent);
  },

  _hideThePopup : function() {
      
    // In addition to hiding the panel, we also set it tiny and move it to
    // the corner (this may not be necessary anymore, but used to help
    // with a workaround for a linux bug).
    let tiny = {width: 0, height: 0};
    this._setImageSize(tiny);
    this._panel.moveTo(9999, 9999);
    if (this._panel.state != "closed") {
      this._panel.hidePopup();
    }
  },
  
  _recreateImgOrVideoTag : function(url) {
      // Remove and recreate the html image node size Firefox 19 and newer 
      // would otherwise return the prior image's width and height and
      // briefly show the prior image on the next pop-up, even though
      // we already cleared its src.
    if (this._endsWith(url, ".webm")) {
      // this._debugToConsole("ThumbnailZoomPlus: recreate image tag as video for " + url);
      // for webm, use "video" tag; see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/video
      var newImg =
          document.createElementNS("http://www.w3.org/1999/xhtml","video");
      newImg.setAttribute("autoplay", "");
      newImg.setAttribute("loop", "1");
      newImg.setAttribute("preload", "auto");
    } else {
      // this._debugToConsole("ThumbnailZoomPlus: recreate image tag as img for " + url);
      var newImg = document.createElementNS("http://www.w3.org/1999/xhtml","img");
    }
    newImg.setAttribute("id", "thumbnailzoomplus-panel-html-image");
    // Replace the current _panelHtmlImage with newImg.  But remove all
    // children of its container since flashblock may have removed
    // or added children!
    var child = this._panelImageDiv.firstChild;
    while (child) {
        this._panelImageDiv.removeChild(child);
        child = this._panelImageDiv.firstChild;
    }
    this._panelImageDiv.appendChild(newImg);
    this._panelHtmlImage = newImg;
  },
  
  /**
   * Closes the panel.
   * @param: clearContext: true iff we should entirely clear this popup's
   *         context.  False if we should hide the popup, but still remember
   *         its image as context e.g. for Save Full-size As...
   *         Note that the act of popping up the
   *         context menu causes the popup to lose focus.
   */
  _closePanel : function(clearContext) {
    try {
      // Note: When called from _handlePageHide after closing window with Control+W
      // while popup is up, some of the statements below raise exceptions
      // e.g. there is no this._contextMenu.  I suspect it's because the
      // chrome is already being destroyed when this is called.  So we
      // silently ignore exceptions here.
      this._logger.trace("_closePanel(clearContext=" + clearContext + ")");
      
      if (clearContext) {
        this._contextMenu.disabled = true;
        this._currentImage = null;
        this._currentPopupFlags = null;
        this._galleryImageUrls = null;
      }
      this._timer.cancel();
      this._removeListenersWhenPopupHidden();

      this._hideCaption();
      this._panelInfo.hidden = true;
      this._panelCaption.ThumbnailZoomPlusOriginalTitleNode = null;
      this._panelImageDiv.style.backgroundImage = ""; // hide status icon
      this._restoreCursor();
      this._timer.cancel(); // in case there's a timer for the popup cursor.

      // Clearing _currentWindow prevents a zombie compartment
      // leak (issue #24).
      // CAUTION: don't do anything after here which needs _currentWindow.
      this._logger.debug("_closePanel: Setting this._currentWindow = null");
      this._currentWindow = null;

      if (this._imageObjectBeingLoaded) {
        // Make sure if we pop down while trying to load the image, we stop
        // trying to load it and clear out the registered handlers so we
        // don't end up with a Zombie Compartment leak (e.g. when trying
        // to load an image on a non-responsive site).
        this._logger.debug("_closePanel: clearing image onload & onerror");
        this._imageObjectBeingLoaded.src = null;
        this._imageObjectBeingLoaded.onload = null;
        this._imageObjectBeingLoaded.onloadeddata = null;
        this._imageObjectBeingLoaded.onerror = null;
        this._imageObjectBeingLoaded = null;
      }
    } catch (e) {
      // This message has been seen in ff15.
      ThumbnailZoomPlus._logExceptionToConsole("_closePanel 1", e);
      this._logger.debug("_closePanel: Setting this._currentWindow = null");
      this._currentWindow = null;
    }
    try {
      this._originalURI = "";
      this._hideThePopup();

      // We no longer need the image contents, and don't want them to show
      // next time we show the working dialog.  This also helps the garbage 
      // collector:
      this._panelHtmlImage.src = null;
      this._panelXulImage.src = null;
      this._currentThumb = null;
      
      // Remove and recreate the html image node.  Firefox 19 and newer
      // would otherwise return the prior image's width and height and
      // briefly show the prior image on the next pop-up, even though
      // we already cleared its src.
      this._recreateImgOrVideoTag("dummy.png");
    } catch (e) {
      ThumbnailZoomPlus._logExceptionToConsole("_closePanel 2", e);
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

    this._showPopupCursor();

    if (this._insideThumbBBox(this._thumbBBox, x, y)) {
      // Mouse is still over the thumbnail.  Ignore the move and don't
      // dismiss since the thumb would immediately receive an 'over' event
      // and retrigger the popup to display.
      this._logger.debug("_handlePopupMove: ignoring since mouse at " +
                         x + "," + y +
                         " is within thumb bbox");
      return;
    }
    // moved outside bbox of thumb; dismiss popup.
    // ignore a mouseOver event over the thumb's bbox, in case our
    // bbox calculation was a bit off; we don't want to popup again
    // if the mouse is still (barely) over the thumb.
    this._setIgnoreBBoxPageRelative();
    // this._debugToConsole("_handlePopupMove: _closePanel(false) with mouse at " +
    //                     aEvent.screenX + "," + aEvent.screenY);
    this._closePanel(false);
  },


  _handlePopupClick : function(aEvent) {
    this._logger.debug("_handlePopupClick: mouse at " +
                        aEvent.screenX + "," + aEvent.screenY);
    this._setIgnoreBBoxPageRelative();
    // this._debugToConsole("_handlePopupClick: _closePanel(false) with mouse at " +
    //                    aEvent.screenX + "," + aEvent.screenY);
    this._closePanel(false);
  },
  
 _asciiName : function(code) {
    var name = "";
    if (code >= 32 && code < 127) {
      name += "'" + String.fromCharCode(code) + "'=";
    }
    name += code;
    return name;
 },
 
 /**
  * _keyName() returns a string indicating the keyboard key of a keyboard event
  * for debugging.  For special keys which don't show ascii in the log you 
  * can look up the codes here: 
  * https://developer.mozilla.org/en-US/docs/DOM/KeyboardEvent
  */
  _keyName : function(aEvent) {
    var name = ("keyCode=" + this._asciiName(aEvent.keyCode) + "; " +
                "charCode=" + this._asciiName(aEvent.charCode) + "; " +
                "which=" + this._asciiName(aEvent.which) );
    if (aEvent.ctrlKey) {
      name += " +Ctrl";
    }
    if (aEvent.altKey) {
      name += " +Alt";
    }
    if (aEvent.shiftKey) {
      name + " +Shift";
    }
    if (aEvent.metaKey) {
      name += " +Meta";
    }
    return name;
  },
  
  _recognizedKey : function(aEvent) {
    if (aEvent.metaKey || aEvent.ctrlKey) {
      // we don't interpret Command+ or Ctrl+ keys as hotkeys.
      return false;
    }
    return (aEvent.keyCode == aEvent.DOM_VK_CONTROL ||
            aEvent.keyCode == aEvent.DOM_VK_SHIFT ||
            aEvent.keyCode == aEvent.DOM_VK_ALT ||
            aEvent.keyCode == aEvent.DOM_VK_EQUALS ||
            aEvent.keyCode == aEvent.DOM_VK_ADD || // "=" on Windows XP
            aEvent.keyCode == aEvent.DOM_VK_SUBTRACT ||
            aEvent.keyCode == aEvent.DOM_VK_HYPHEN_MINUS || // Firefox 15.0 and newer
            aEvent.keyCode == aEvent.DOM_VK_OPEN_BRACKET ||
            aEvent.keyCode == aEvent.DOM_VK_CLOSE_BRACKET ||
            aEvent.keyCode == aEvent.DOM_VK_LEFT ||
            aEvent.keyCode == aEvent.DOM_VK_RIGHT ||
            (aEvent.keyCode >= aEvent.DOM_VK_A &&
             aEvent.keyCode <= aEvent.DOM_VK_Z) ||
            aEvent.keyCode == aEvent.DOM_VK_ESCAPE ||
            (aEvent.keyCode >= aEvent.DOM_VK_0 &&
             aEvent.keyCode <= aEvent.DOM_VK_9)
           );
  },

  _passKeyEventToPage : function(aEvent) {
    if (! this._currentThumb) {
      return;
    }
    if (aEvent.metaKey || aEvent.ctrlKey) {
      // don't send key w/ Control/Command since it gets
      // passed automatically, and sending it here would cause
      // it to be sent twice (eg cancelling the effect of
      // Command+Shift+F full-screen).
      return;
    }
    if (! this._popupTakesFocus()) {
      // If the popup doesn't take focus, the page still has focus and the
      // event will automatically get to the page.  So we don't need to
      // explicitly pass it.  If we did, we could cause event cycling.
      return;
    }

    this._debugToConsole("_passKeyEventToPage for " + this._keyName(aEvent));    

    if (aEvent.keyCode == aEvent.DOM_VK_DOWN ||
        aEvent.keyCode == aEvent.DOM_VK_UP) {
      if (aEvent.type == "keydown") {
        var delta = (aEvent.keyCode == aEvent.DOM_VK_DOWN) ? 2 : -2;
        this._currentWindow.scrollByLines(delta);
      }
      
    } else if (aEvent.keyCode == aEvent.DOM_VK_LEFT ||
               aEvent.keyCode == aEvent.DOM_VK_RIGHT) {
    /* DISABLED so left/right can move through gallery:
      if (aEvent.type == "keydown") {
        var delta = (aEvent.keyCode == aEvent.DOM_VK_LEFT) ? -16 : 16;
        this._currentWindow.scrollBy(delta, 0);
      }
    */
    } else {
    
      // Send synthetic event to the web page itself.
      // This allows e.g. Return to follow the link.
      // Note that it doesn't allow scrolling to work; perhaps
      // the doc but not Firefox chrome receives the event; we worked
      // around that by detecting up/down explicitly above.
      
      let doc = this._currentThumb.ownerDocument;
      let synthetic = doc.createEvent("KeyboardEvent");
      /* template: event.initKeyEvent (type, bubbles, cancelable, viewArg, 
                        ctrlKeyArg, altKeyArg, shiftKeyArg, metaKeyArg, 
                        keyCodeArg, charCodeArg)  */
      synthetic.initKeyEvent(aEvent.type,
                    aEvent.bubbles, aEvent.cancelable, this._currentWindow,
                    aEvent.ctrlKey, aEvent.altKey, aEvent.shiftKey, aEvent.metaKey,
                    aEvent.keyCode, aEvent.charCode);
      this._logger.debug("_passKeyEventToPage: sending type=" +
                         synthetic.type + " keyCode="  + aEvent.keyCode +
                         " to " + this._currentWindow + " " + 
                         this._currentThumb);

      this._currentThumb.dispatchEvent(synthetic);
    
    }
  },

  _handleKeyDown : function(aEvent) {
    let that = ThumbnailZoomPlusChrome.Overlay;
    that._doHandleKeyDown(aEvent);
  },
  
  _doHandleKeyDown : function(aEvent) {
    this._debugToConsole("_doHandleKeyDown for " + this._keyName(aEvent));    
    if (this._isKeyActive(this.PREF_PANEL_MAX_KEY, false, false, aEvent)) {
      this._logger.debug("_doHandleKeyDown: maximize image since max-key is down");
      this._currentMaxScaleBy = Math.max(this._currentMaxScaleBy, this._maximizingMaxScaleBy);
      this._currentAllowCoverThumb = true;
      this._redisplayPopup();
    }
    
    if (aEvent.metaKey || aEvent.ctrlKey) {
      // we don't interpret most Command+ or Ctrl+ keys as hotkeys.
      return;
    }

    if (aEvent.keyCode == aEvent.DOM_VK_P) {
      // open preferences
      this._logger.debug("_doHandleKeyDown: openPreferences since pressed p key");
      this.openPreferences();
      
    } else if (aEvent.keyCode == aEvent.DOM_VK_C) {
      this._logger.debug("_doHandleKeyDown: copy image to clipboard");
      this._copyToClipboard(true, false);

    } else if (aEvent.keyCode == aEvent.DOM_VK_L) {
      this._logger.debug("_doHandleKeyDown: copy image location to clipboard");
      this._copyToClipboard(false, true);

    } else if (aEvent.keyCode == aEvent.DOM_VK_I) {
      // toggle caption
      let allowCaption = ThumbnailZoomPlus.togglePref(this.PREF_PANEL_CAPTION);
      this._logger.debug("_doHandleKeyDown: toggle caption-info to " + allowCaption +
                         " since pressed c key");      
      // redisplay to update displayed caption.
      if (this._currentThumb) {
        var captionPrefix = ""; // not available
        this._setupCaption(this._currentThumb, captionPrefix);
      }
      this._redisplayPopup();
      
    } else if (aEvent.keyCode == aEvent.DOM_VK_T ||
               aEvent.keyCode == aEvent.DOM_VK_B) {
      // open image in new tab
      //
      // Note: The add-on validator warns "`\.documentURIObject` only available in chrome contexts";
      // that warning can be ignored since we *are* in chrome context.
      this._logger.debug("_doHandleKeyDown: open in new tab " +this._currentImage +
                         " referrer " + document.documentURIObject);
      let options = {referrerURI: document.documentURIObject, relatedToCurrent: true};
      let openLocation = aEvent.keyCode == aEvent.DOM_VK_T ? "tab" : "tabshifted";
      let tab = openUILinkIn(this._currentImage, openLocation, options);
      gBrowser.selectedTab = tab;
      
    } else if (aEvent.keyCode == aEvent.DOM_VK_N) {
      // open image in new browser window
      this._logger.debug("_doHandleKeyDown: open in new window");
      window.open(this._currentImage, 
                  "ThumbnailZoomPlusImageWindow",
                  "chrome=no,titlebar=yes,resizable=yes,scrollbars=yes,centerscreen=yes");
      
    } else if (aEvent.keyCode == aEvent.DOM_VK_G) {
      // open 'Google Images' search in new tab
      this._logger.debug("_doHandleKeyDown: google search for image " +this._currentImage);
      let options = {referrerURI: null, relatedToCurrent: true};
      // Example full URL: https://www.google.com/searchbyimage?image_url=http%3A%2F%2Fi.imgur.com%2F7p1wA.jpg&encoded_image=&image_content=&filename=&num=10&hl=en&safe=off&bih=711&biw=1366
      // Example minimal URL: https://www.google.com/searchbyimage?image_url=http%3A%2F%2Fi.imgur.com%2F7p1wA.jpg
      let url = "https://www.google.com/searchbyimage?site=search&image_url=" + encodeURIComponent(this._currentImage);
      let tab = openUILinkIn(url, "tab", options);
      gBrowser.selectedTab = tab;
      
    } else if (aEvent.keyCode == aEvent.DOM_VK_S) {
      this._logger.debug("_doHandleKeyDown: save image");
      this.downloadImage();
      
    } else if (aEvent.keyCode == aEvent.DOM_VK_X) {
      this._logger.debug("_doHandleKeyDown: toggle TZP 'enable'");
      ThumbnailZoomPlus.togglePref(this.PREF_PANEL_ENABLE);
      // code in _handleKeyUp() closes the popup.
      
    } else if (aEvent.keyCode == aEvent.DOM_VK_EQUALS ||
               aEvent.keyCode == aEvent.DOM_VK_ADD || // for Windows XP
               aEvent.keyCode == aEvent.DOM_VK_SUBTRACT ||
               aEvent.keyCode == aEvent.DOM_VK_HYPHEN_MINUS // Firefox 15.0 and newer
              ) {
      // scale about 2x as fast as Firefox's 1.1, and bigger than the 1.12
      // checks used to decide if a size is enough larger to be worth covering
      // the thumb.
      let factor = 1.20; 
      if (aEvent.keyCode == aEvent.DOM_VK_SUBTRACT ||
          aEvent.keyCode == aEvent.DOM_VK_HYPHEN_MINUS // Firefox 15.0 and newer
          ) {
        factor = 1.0 / factor;
      }
      this._currentMaxScaleBy *= factor;
      this._logger.debug("_doHandleKeyDown: scale *= " +
                         factor + " gives " + this._currentMaxScaleBy);
      this._redisplayPopup();

    } else if (aEvent.keyCode == aEvent.DOM_VK_0) {
      this._currentMaxScaleBy = 1.0;
      this._logger.debug("_doHandleKeyDown: reset scale = 1.0");
      this._redisplayPopup();
      
    } else if (aEvent.keyCode == aEvent.DOM_VK_OPEN_BRACKET ||
               aEvent.keyCode == aEvent.DOM_VK_CLOSE_BRACKET ||
               aEvent.keyCode == aEvent.DOM_VK_LEFT ||
               aEvent.keyCode == aEvent.DOM_VK_RIGHT) {
      // left and right arrows or brackets go to previous/next URL numerically.
      // brackets are useful within a site like imgur.com gallery where
      // the site interprets left and right.
      this._logger.debug("_doHandleKeyDown: increment/decrement URL");
      let delta = (aEvent.keyCode == aEvent.DOM_VK_OPEN_BRACKET ||
                   aEvent.keyCode == aEvent.DOM_VK_LEFT) ? -1 : +1;
      let aImageSrc = this._getAdjacentImage(this._currentImage, delta);
      this._debugToConsole("_doHandleKeyDown: delta of " + delta + " yields\n" + 
                           aImageSrc);
      // TODO:this._galleryImageUrls in the 'if' below means these
      // keys work only for recognized galleries, and we've lost the
      // ability to use the to simply increment numbers in the URL.
      // We could change it to increment on [ or ] and use arrows
      // for prev/next gallery.  Incrementing on arrows would be confusing
      // since users would think they have a broken gallery.
      if (aImageSrc && this._currentThumb && this._galleryImageUrls) {
        this._currentPopupFlags.requireImageBiggerThanThumb = false;
        this._currentPopupFlags.imageSourceNode = this._currentThumb;
        this._currentPopupFlags.captionPrefix = (this._galleryPosition+1) + " of " +
                                                 this._galleryImageUrls.length + ": ";
        this._currentPopupFlags.borderColor = this._galleryPosition == 0 ?
                                                "#aaffaa" : // light green
                                                "#668866"; // dark green

        this._currentImage = aImageSrc;
        this._debugToConsole("ThumbnailZoomPlus: >>> [ or ] launching \n" +
                             aImageSrc);
        this._recreateImgOrVideoTag(aImageSrc);
        
        // displaying the new image will close the current one; we don't
        // want that to cause a popup of the current image again.
        this._setIgnoreBBoxPageRelative();
        this._showZoomImage(aImageSrc, this._currentPopupFlags, this._currentThumb,
                            aEvent);
      }

    } else if (aEvent.keyCode == aEvent.DOM_VK_D) {
      // Set default scale based on current scale.
      this._logger.debug("_doHandleKeyDown: set default zoom pref");
      this._setDefaultScalePref(this._currentMaxScaleBy);
      
    } else if (aEvent.keyCode == aEvent.DOM_VK_A) {
      this._logger.debug("_doHandleKeyDown: toggle allow-covering-thumb pref");
      this._currentAllowCoverThumb = ! this._getAllowCoverThumbPref();
      ThumbnailZoomPlus.setPref(this.PREF_PANEL_LARGE_IMAGE,
                                this._currentAllowCoverThumb);
      if (this._currentAllowCoverThumb) {
        // Size may have been limited by disallowing covering, but if it's off
        // now we may need a larger size.  Allow for that.
        this._currentMaxScaleBy = Math.max(this._currentMaxScaleBy,
                                           this._getDefaultScalePref());
      }
      this._logger.debug("_doHandleKeyDown: set allowCoverThumb = " +
                         this._currentAllowCoverThumb + 
                         "; _currentMaxScaleBy = " + this._currentMaxScaleBy);
      this._redisplayPopup();
    }
    
    if (this._recognizedKey(aEvent)) {
      this._logger.debug("_doHandleKeyDown: ignoring key event");
      aEvent.stopPropagation(); // the web page should ignore the key.
      aEvent.preventDefault();
    } else {
      this._passKeyEventToPage(aEvent);
    }
  },
  
  _handleKeyUp : function(aEvent) {
    let that = ThumbnailZoomPlusChrome.Overlay;
    that._debugToConsole("_handleKeyUp for " + that._keyName(aEvent));    

    // Handle Escape or x to cancel popup in key-up.  We couldn't do it in
    // key-down because key-down would then unregister key listeners,
    // and escape key-up would go through to the web page, which we
    // don't want.
    let enable = ThumbnailZoomPlus.getPref(that.PREF_PANEL_ENABLE, true);
    if (aEvent.keyCode == aEvent.DOM_VK_ESCAPE ||
        (aEvent.keyCode == aEvent.DOM_VK_X && !enable) ) {
      that._debugToConsole("_handleKeyUp: _closePanel(false) since pressed Esc or x key");
      that._setIgnoreBBoxPageRelative();
      that._closePanel(false);
    }
    if (that._recognizedKey(aEvent)) {
      that._logger.debug("_handleKeyUp: ignoring key event");
      aEvent.stopPropagation(); // the web page should ignore the key.
      aEvent.preventDefault();
    } else {
      that._passKeyEventToPage(aEvent);
    }
  },
  
  _handleKeyPress : function(aEvent) {
    let that = ThumbnailZoomPlusChrome.Overlay;
    that._debugToConsole("_handleKeyPress for " + that._keyName(aEvent));    

    if (that._recognizedKey(aEvent)) {
      // Ignore this key.  
      that._logger.debug("_handleKeyPress: ignoring key event");
      aEvent.stopPropagation(); // the web page should ignore the key.
      aEvent.preventDefault();
    } else {
      // Unlike the other key events, keyPress gets
      // code 0 when regular letters are entered, so
      // we ignore them by checking for 0 (so we don't eg enter them
      // into a gmail compose window).
      if (aEvent.keyCode != 0) {
        that._passKeyEventToPage(aEvent);
      }
    }
  },
  
  _needToPopDown : function(view) {
    // null view and "TypeError: can't access dead object" reported when
    // accessing view.top.  In the case of "dead object",
    // TZP stopped working.  I had clicked a link and Firefox was spinning
    // waiting to load it, while the prior page was still visible.
    // Moving mouse over that prior page caused these errors and no pop-ups.
    // To work around at least the null problem we test for it.
    if (! view) {
        this._debugToConsole("_needToPopdown: ignoring due to null view");
        return;
    }
    var affectedWindow = view.top;
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
    let affectedView = aEvent.originalTarget.defaultView;
    that._logger.trace("_handlePageHide");
    if (that._needToPopDown(affectedView)) {
      that._debugToConsole("_handlePageHide: _closePanel(true)");
      that._closePanel(true);
    }
    return true; // allow page to hide
  },
  
  _handleHashChange : function(aEvent) {
    let that = ThumbnailZoomPlusChrome.Overlay;
    that._logger.trace("_handleHashChange");
    that._debugToConsole("_handleHashChange: _closePanel(true)");
    that._closePanel(true);
  },
  
  /**
   * _getAdjacentImage returns the URL of the 'adjacent' image, meaning the one
   * before or after the current one, according to delta (-1 or +1).
   * For galleries, this updates the current gallery position and returns the
   * corresponding image.  For other images it tries to increment/decrement
   * a number in the URL.
   */
  _getAdjacentImage : function(url, delta) {
    if (this._galleryImageUrls) {
      var length =this._galleryImageUrls.length;
      this._galleryPosition = (this._galleryPosition + delta + length) % length;
      return this._galleryImageUrls[this._galleryPosition];
    } else {
      return this._offsetUrl(url, delta)
    }
  },
  
  /**
   * _offsetUrl returns an image's url with an appropriate numeric part
   * offset by adding delta (typically -1 or +1).  Returns the adjusted url or
   * null if it couldn't find an appropriate numeric part.
   * Example:
   *   On page http://my.opera.com/Milano1/albums/showpic.dml?album=7138392&picture=107119352 image
   *   http://files.myopera.com/Milano1/albums/7138392/11.jpg with offset=1 becomes 
   *   http://files.myopera.com/Milano1/albums/7138392/12.jpg
   */
  _offsetUrl : function(url, delta) {
    this._logger.debug("_offsetURL: from " + url);
    let re = /(.*?)([0-9]+)([^\/0-9]*)$/;
    let match = re.exec(url);
    if (match) {
      this._logger.debug("_offsetURL: match=" + match[1] + ", " + match[2] + ", " + match[3]);
    }
    let newUrl = url.replace(re,
      function(matchPart, prefix, num, suffix) {
                             let adj = String((+num) + delta);
                             if (num[0] == "0" &&
                                 num.length > adj.length) {
                             // original image has 0-pading; pad to the same length.
                             // Note that when decrementing eg down from 10 we don't
                             // know whether or not to pad (to 9 or 09) so we don't pad.
                             adj = "0000000000".substring(0, num.length - adj.length) + adj;
                             }
                             let result = prefix + adj + suffix
                             return result;
                             });
    if (newUrl == url) {
      return null;
    }
    this._logger.debug("_offsetURL: got " + newUrl);
    return newUrl;
  },
  
  _showStatusIcon : function(aImageNode, iconName, iconWidth, flags) {
    this._logger.trace("_showStatusIcon");
    
    this._setCursorAndBorderColor(aImageNode, flags);
    let bg =
      "url(\"chrome://thumbnailzoomplus/skin/images/" + iconName + "\")";
    if (this._panelImageDiv.style.backgroundImage == bg) {
      this._logger.debug("_showStatusIcon: already showing " + iconName);
      return;
    }
    this._panelImageDiv.style.backgroundImage = bg;

    let iconHeight = 16 + (this._panelInfo.hidden ? 0 : 20);
    this._setExactSize(this._panelImageDiv, iconWidth, iconHeight);
    
    this._panelCaption.hidden = true;
    let panelHeight = iconHeight + this._widthAddon + this._panelHeightAddon;
    this._panel.sizeTo(iconWidth + this._widthAddon + this._panelWidthAddon,
                       panelHeight);

    let x = this._thumbBBox.xMax + this._pad;
    let y = this._thumbBBox.yMin;
    this._logger.debug("_showStatusIcon: showing " + iconName +
                       " at " + x + "," + y + 
                       " size " + iconWidth + ", 16; state=" +
                       this._panel.state);

    this._panelXulImage.hidden = true;
    this._panelHtmlImage.hidden = true;
    if (this._panel.state != "open") {
      this._logger.debug("_showStatusIcon: popping up to show " + iconName);
      this._panel.openPopup(aImageNode, "end_before", this._pad, this._pad, false, false);
    } 
    this._focusThePopup(aImageNode);
    this._addListenersWhenPopupShown(aImageNode);
  },
  
  _showStatusIconBriefly : function(aImageNode, iconName, iconWidth, flags) {
    this._logger.trace("_showStatusIconBriefly");

    // Note that we don't clear this._panelHtmlImage.src nor
    // this._panelXulImage.src since we need them if the user presses Shift
    // after a too-small warning (to display the image overlapping the thumb).
    
    this._showStatusIcon(aImageNode, iconName, iconWidth, flags);
    
    // Hide the icon after a little while
    this._timer.cancel();
    let that = this;
    this._timer.initWithCallback(
        { notify: function() { 
            // that._debugToConsole("_showStatusIconBriefly callback: _closePanel(false)");
            that._closePanel(false); } }, 
        1.5 * 1000, Ci.nsITimer.TYPE_ONE_SHOT);
  },
  
  /**
   * _checkIfImageLoaded is called from a repeating timer after we
   * start loading.  It checks whether enough has been loaded to
   * know image dimensions.  If so, it displays the full-size popup
   * (which cancels the timer).
   */
  _checkIfImageLoaded : function(aImageNode, aImageSrc, 
                                 flags,
                                 image)
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
    this._showStatusIcon(aImageNode, "working-3dots.png", 16, flags);      
    
    if (this._panelHtmlImage.localName == "img") {
      let imageWidth  = image.naturalWidth;
      let imageHeight = image.naturalHeight;
      var haveSize = (imageWidth > 0 && imageHeight > 0);
      this._debugToConsole("_checkIfImageLoaded: naturalWidth=" + image.naturalWidth +
                         "; width=" + image.width + "; iw=" + imageWidth);
    } else {
      // assume "video" tag.
      var haveSize = image.readState > 0;
      this._debugToConsole("_checkIfImageLoaded: readState=" + image.readState +
                         "; height = " + image.height + "; videoHeight=" + image.videoHeight);
    }
    if (haveSize) {
      /*
       * The image has a size so we could technically display it now.  But that
       * often causes it to appear very briefly only half-displayed, with
       * its lower half white.  We try to prevent that by displaying it a bit
       * later, using the timer again.
       */
      this._timer.cancel();
      let that = this;
      let delay = this._getPartialLoadTime();
      if (/\.gif/.test(aImageSrc)) {
        // Animated gif's can take much longer to load than the time when
        // they could first be dispalyed, so override the user's setting.
        delay = Math.min(delay, 0.1);
      }
      this._logger.debug("_checkIfImageLoaded: calling _imageOnLoad since have size, delayed "
                         + delay + " ms");
      this._timer.initWithCallback(
        { notify:
          function() {
            that._imageOnLoad(aImageNode, aImageSrc, 
                              flags, image);
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
                          flags, image)
  {
    this._logger.trace("");
    this._logger.trace("_imageOnLoad");

    if (this._currentImage != aImageSrc) {
      // A different image than our current one finished loading; ignore it.
      return;
    }
    
    // Firefox Nightly 21 and Aurora 20 seem to call image's onerror
    // after calling onloaded, even when the image seems to have been
    // fully and successfully loaded.  This was causing TZP bug 108:
    // TZP stops working on Nightly.  We work around that by disabling
    // the onerror callback when we get an onload.  It's not a 100% fix
    // since Firefox still seems to call onerror before onload, causing a
    // brief flicker of the error indicator.
    image.onerror = null;

    // This is the image URL we're currently loading (not another previously
    // image we had started loading).

    // Make sure we don't get called again as an onLoad, if current call
    // was due to the timer.
    image.onload = null;
    image.onloadeddata = null;
    
    this._timer.cancel();

    let pageZoom = gBrowser.selectedBrowser.markupDocumentViewer.fullZoom;

    // Seen in ff15: Error: TypeError: can't access dead object
    let thumbWidth = aImageNode.clientWidth * pageZoom;
    let thumbHeight = aImageNode.clientHeight * pageZoom;
    
    /*
     * Get image size from naturalWidth, which tells us the image's true
     * size, uninfluenced by CSS
     */
    this._debugToConsole("ThumbnailZoomPlus: image tag type: " + image.localName);
    if (image.localName == "video") {
      var imageWidth  = image.videoWidth;
      var imageHeight = image.videoHeight;
     } else {
      // img
      var imageWidth  = image.naturalWidth;
      var imageHeight = image.naturalHeight;
    }
    this._debugToConsole("_imageOnLoad: width=" + imageWidth + "; height=" + imageHeight +
                         ".width=" + image.width + "; .videoWidth=" + image.videoWidth);

    if (imageWidth == 0 || imageHeight == 0) {
      // Some images (such as .svg Scalable Vector Graphics) don't always have
      // an explicit size.  Give it an arbitrary resolution, at which it'll
      // render.
      this._logger.debug("_imageOnLoad: got 0 width or height; using 1000.");
      imageWidth = 1000;
      // Use same aspect as thumb (not not too extreme since the thumb may actually
      // be long text in an <a> tag).
      let aspect = 1.0;
      if (thumbWidth != 0 && thumbHeight != 0) {
        aspect = thumbHeight / thumbWidth;
      }
      aspect = Math.min(4.0, Math.max(aspect, 0.25));
      imageHeight = imageWidth * aspect;
    }
    
    if (flags.requireImageBiggerThanThumb &&
        (thumbWidth  >= imageWidth ||
         thumbHeight >= imageHeight) ) {
      // skip
      // TODO: ought to allow if file types are different (like the
      // check already done in _sizePositionAndDisplayPopup).
      this._logger.debug("_imageOnLoad: skipping popup since requireImageBiggerThanThumb" +
                         " and thumb is " + thumbWidth + " x " + thumbHeight +
                         " which is >= than raw image " +
                         imageWidth + " x " + imageHeight);
      this._debugToConsole("ThumbnailZoomPlus: >>> skipping since too small \n" + aImageSrc);
      // Make sure we close the 'working' status icon.
      // this._debugToConsole("_imageOnLoad: _closePanel(false)");
      this._closePanel(false);
    } else {
      if (flags.requireImageBiggerThanThumb) {
        this._logger.debug("_imageOnLoad: showing popup since requireImageBiggerThanThumb" +
                         " and thumb is " + thumbWidth + " x " + thumbHeight +
                         " which is < raw image " +
                         imageWidth + " x " + imageHeight);
      }
      this._currentThumb = aImageNode;
      this._origImageWidth = imageWidth;
      this._origImageHeight = imageHeight;
      
      let loadInTempImage = (image != this._panelHtmlImage);
      this._panelXulImage.hidden = ! loadInTempImage;
      this._panelHtmlImage.hidden = loadInTempImage;

      let displayed =
        this._sizePositionAndDisplayPopup(this._currentThumb, aImageSrc,
                                          flags, 
                                          this._origImageWidth, this._origImageHeight);
      if (displayed) {
        this._addListenersWhenPopupShown(aImageNode);
        this._addItemsToHistory(aImageSrc, flags.imageSourceNode);
      } else {
        this._hideCaption();
      }
    }
    
    if (image != this._panelHtmlImage) {
      // Help the garbage collector reclaim memory quickly.
      // (Test by watching "images" size in about:memory.)
      // This also prevents the image from restarting at the start
      // of image when it's done loading.
      image.src = null;
      image = null;
    }
  },

  _redisplayPopup : function()
  {
    this._logger.trace("_redisplayPopup " + this._currentImage);

    if (this._currentThumb != null) {
      // Close the panel to ensure that we can popup the new panel at a specified
      // location. 
      if (this._panel.state != "closed") {
        // temporarily remove listeners so we don't get a "blur" (losing
        // focus) event when we pop down the window.  That even would cause
        // the popup to stay closed, which we don't want.
        this._removeListenersWhenPopupHidden();

        // We could set ignore region so if mouse loses focus due to "0" or "-"
        // changing popup position, we don't re-popup with default zoom.
        // But we don't since that'd re-create 
        // bug #56: Google images popup may stay up from prior image
        // DISABLED: this._setIgnoreBBoxPageRelative();

        this._panel.hidePopup();
      }
      let flags = new ThumbnailZoomPlus.FilterService.PopupFlags();
      flags.noTooSmallWarning = true;
      this._sizePositionAndDisplayPopup(this._currentThumb, this._currentImage, flags,
                                        this._origImageWidth, this._origImageHeight);

      // re-add back the listeners.
      this._addListenersWhenPopupShown(this._currentThumb);
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
    
    let showPercent = ThumbnailZoomPlus.getPref(this.PREF_PANEL_SHOW_PERCENT, true);
    if (showPercent && displayedImageWidth > 90) {
      // Display the actual size % unless it would cover too much of the image.
      this._panelInfo.value = " " + percent + "% ";
      this._panelInfo.hidden = false;
    } else {
      this._panelInfo.hidden = true;
    }
  },
  
  /**
   * _getFileType returns the file type (such as ".jpg" or ".gif" or "")
   * of the specified filename, or null if filename is blank or null.
   * In addition to regular URLs we support background-image styles
   * such as url("http://i.imgur.com/jA4dH.jpg") .
   */
  _getFileType : function(filename)
  {
    if (filename == null || filename == "") {
      return null;
    }
    let fileTypeRex = /^[^?&]*(\.[a-z0-9]+)([?&\)].*)?$/i;
    // image URLs sometimes don't have an explicit type; default to .jpg.
    let type = ".jpg";
    if (fileTypeRex.test(filename)) {
      type = filename.replace(fileTypeRex, "$1");
    }
    return type;
  },
  
  _sizePositionAndDisplayPopup : function(aImageNode, aImageSrc,
                                          flags, 
                                          imageWidth, imageHeight)
  {
    let pageZoom = gBrowser.selectedBrowser.markupDocumentViewer.fullZoom;
    
    let available = this._getAvailableSizeOutsideThumb(aImageNode, flags);
    let thumbWidth = aImageNode.clientWidth * pageZoom;
    let thumbHeight = aImageNode.clientHeight * pageZoom;
    this._logger.debug("_sizePositionAndDisplayPopup: thumb size = " +
                       thumbWidth + " x " + thumbHeight +
                       "; pageZoom=" + pageZoom);

    // Get the popup image's display size, which is the largest we
    // can display the image (without magnifying it and without it
    // being too big to fit on-screen).
    let imageSize = this._getScaleDimensions(imageWidth, imageHeight, available,
                                             flags, thumbWidth, thumbHeight);
    let thumbSrc = aImageNode.getAttribute("src") || aImageNode.style.backgroundImage;
    let thumbType = this._getFileType(thumbSrc);
    let imageType = this._getFileType(aImageSrc);
    this._logger.debug("_sizePositionAndDisplayPopup: file types: thumb=" + 
                       thumbType + 
                       "; popup=" + imageType + " from thumb=" + 
                       aImageNode.localName + " " + thumbSrc + 
                       " and image=" + aImageSrc);
    if (! imageSize.allow) {
      if (thumbType && thumbType != imageType) {
        // If file types are different, show it even if it's not bigger, since
        // it may be better quality or an animated gif from a static thumb.
        this._logger.debug("_sizePositionAndDisplayPopup: forcing allow since different file types"); 
        imageSize.allow = true;
      }
    }
    
    this._logger.debug("_sizePositionAndDisplayPopup: available w/l/r:" + available.width + 
                       "/" + available.left + 
                       "/" + available.right +
                       "; h/t/b:" + available.height + 
                       "/" + available.top + 
                       "/" + available.bottom + 
                       "; adj windowWidth, Height: " + 
                       available.windowWidth + "," + available.windowHeight);
    this._logger.debug("_sizePositionAndDisplayPopup: " + 
                       "; _currentMaxScaleBy=" + this._currentMaxScaleBy +
                       "; win width=" + available.windowWidth +
                       "; win height=" + available.windowHeight +
                       "; full-size image=["+imageWidth + "," + imageHeight + 
                       "]; max imageSize which fits=["+imageSize.width + "," + imageSize.height +"]"); 
    
    if (! imageSize.allow) {
      if (! flags.noTooSmallWarning) {
        // show the thumb's size as a % of raw image's size, so the user
        // can tell if it's worth opening the image in a tab to
        // see it bigger than could fit in the window.
        this._updateForActualScale(thumbWidth, imageWidth);
        this._showStatusIconBriefly(aImageNode, "tooSmall16.png", 32, flags);      
        this._debugToConsole("ThumbnailZoomPlus: >>> too small (and warned)\n" + aImageSrc);
      } else {
        this._logger.debug("_sizePositionAndDisplayPopup: too small (but noTooSmallWarning)");
        this._debugToConsole("ThumbnailZoomPlus: >>> too small (silently)\n" + aImageSrc);
        // close the popup in case we showed the 'working' indicator:
        // this._debugToConsole("_sizePositionAndDisplayPopup: _closePanel(false)");
        this._closePanel(false);
      }
      
      return false;
    }
    
    this._openAndPositionPopup(aImageNode, imageSize, available);
    this._updateForActualScale(imageSize.width, imageWidth);
    this._showPopupCursor();
    
    return true;
  },
  
  /**
   * Preloads the image.
   * @param aImageNode the image node.
   * @param aImageSrc the image source.
   * @param aEvent the mouse event which caused us to preload the image.
   */
  _preloadImage : function(aImageNode, aImageSrc, 
                           flags, aEvent) {
    this._logger.trace("_preloadImage");

    let that = this;

    /*
       Create a new Image object, which isn't displayed anywhere.  The
       more direct way would be to use the pop-up's img node without this node,
       but testing indicates that a displayed img or image node doesn't set
       its width and height properties as quickly when the image is only
       partially loaded.  Using a separate Image node allows us to show
       the partial image sooner. 
     */
    var image;
    let loadInTempImage = /\.gif/.test(aImageSrc);
    this._logger.debug("_preloadImage: loadInTempImage=" + loadInTempImage);

    this._recreateImgOrVideoTag(aImageSrc);
    if (loadInTempImage) {
      // We don't load solely into _panelXulImage since an xul image doesn't
      // return a valid width when queried; we must also load into the
      // _panelHtmlImage so we can query its size.
      image = new Image();
      
      // TODO: need to make sure this gets deleted.
    } else {
      image = this._panelHtmlImage;
    }

    this._imageObjectBeingLoaded = image;
    
    let pageZoom = gBrowser.selectedBrowser.markupDocumentViewer.fullZoom;

    // TODO: it'd be better to save the image object in the ThumbnailZoomPlus
    // object so we can delete it if we load different image (so it doesn't
    // keep loading in the background).
    image.onerror = function(aEvent) {
      that._logger.debug("In image onerror");
      if (that._currentImage != aImageSrc) {
        // A different image than our current one finished loading; ignore it.
        return;
      }
      image.onerror = null; // protect against multiple calls (seen in ff 20).
      that._hideCaption();
      that._debugToConsole("ThumbnailZoomPlus: >>> error loading\n" + aImageSrc);
      that._logger.debug("image onerror: show warning briefly since error loading image (" + aEvent + ")");

      if (! flags.noErrorIndicator) {
        that._showStatusIconBriefly(aImageNode, "warning16.png", 32, flags);
      } else {
        // Close the "working" indicator. 
        // that._debugToConsole("_preloadImage onerror: _closePanel(false)");
        that._closePanel(false);
      }
      that._imageObjectBeingLoaded = null;
    };

    if (this._isKeyActive(this.PREF_PANEL_MAX_KEY, false, true, aEvent)) {
      this._currentMaxScaleBy = Math.max(this._currentMaxScaleBy, this._maximizingMaxScaleBy);
      this._currentAllowCoverThumb = true;
      flags.requireImageBiggerThanThumb = false;
    }
    image.onload = function() {
      that._imageOnLoad(aImageNode, aImageSrc, flags, image);
      that._imageObjectBeingLoaded = null;
    };
    image.onloadeddata = image.onload;
    
    if (loadInTempImage) {
      // We don't load solely into _panelXulImage since an xul image doesn't
      // return a valid width when queried; we must also load into the
      // _panelHtmlImage so we can query its size.
      this._panelXulImage.src = aImageSrc;
    }
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
                                     flags, image);
          }
      }, 0.3 * 1000, Ci.nsITimer.TYPE_REPEATING_SLACK);
  },

  /**
   * Gives the popup keyboard focus, so the user can direct key commands to it.
   * Because we listen for hotkeys only on the popup itself, we're sure
   * we won't interpret typing in other areas such as the Location bar.
   *
   * Note: hotkeys don't seem to work in Firefox 3.6 (at least on mac),
   * possibly related to use of _focusThePopup.  The log doesn't show that
   * we get a key event at all.
   */
  _focusThePopup : function(aImageNode) {
    if (! this._popupTakesFocus()) {
      return;
    }
    if (! this._allowPopupTakesFocusForNode(aImageNode)) {
      return;
    }
    
    if (! this._currentWindow) {
      this._logToConsole("_focusThePopup: _currentWindow is null");
      return;
    }
    
    let doc = this._currentWindow.document;
    let focused = doc.activeElement;

    if (focused && focused.tagName != "BODY") {
      // The previously-focused element wasn't the document itself,
      // so send synthetic focus events (more details below).  
      // Note that we test 'focused' rather than 'aImageNode'; testing the 
      // latter would cause popup cycling on Google's "Visually related images".
      this._logger.debug("_focusThePopup: aImageNode=" + aImageNode + 
                         "; focused=" + focused + "; sending mouseover event");
      
      // The focused element will lose focus when we give the popup focus.  Make
      // it lose focus now so it'll send the inevitible blur (focus-loss) event.
      // Then send a synthetic mouseover event so Firefox will continue to show
      // the link's URL.  Fixes issue #60: Firefox doesn't show link URL after 
      // popup displays.
      focused.blur();
      let synthetic = doc.createEvent("MouseEvents");
      /* template: event.initMouseEvent(type, canBubble, cancelable, view, 
                     detail, screenX, screenY, clientX, clientY, 
                     ctrlKey, altKey, shiftKey, metaKey, 
                     button, relatedTarget); */
      synthetic.initMouseEvent("mouseover", true, true, this._currentWindow,
                    0,   0, 0,   0, 0,   
                    false, false, false, false,
                    0,  focused);
      aImageNode.dispatchEvent(synthetic);
    }

    this._panelFocusHost.focus();
  },
  
  /**
   * Opens the popup positioned appropriately relative to the thumbnail
   * aImageNode.
   * @param aImageNode: the thumb or link from which we're popping up
   * @param: imageSize: the size of the image itself as we'll be displaying it
   *                    (i.e. reduced to fit as appropriate)
   * @param: available: the available space in .left, .right, .top, .bottom, 
   *                          .width, .height
   */
  _openAndPositionPopup : function(aImageNode, imageSize, available) {
    this._logger.trace("_openAndPositionPopup");
    
    let wantCaption = (this._panelCaption.value != "" &&
                       this._panelCaption.value != " ")
    let pos = this._calcPopupPosition(imageSize, wantCaption, available);
    
    this._panelImageDiv.style.backgroundImage = ""; // hide status icon
    
    this._panelCaption.hidden = ! wantCaption;
    this._setImageSize(imageSize);
    // Explicitly move panel since if it was already popped-up, openPopupAtScreen
    // won't do anything.
    this._panel.moveTo(pos.x, pos.y);

    // popping up can cause a mouseout event if the mouse ends up over
    // the popup.  Prevent that with a tiny bbox.
    this._movedSincePoppedUp = false;

    this._panel.openPopupAtScreen(pos.x, pos.y, false);
    this._focusThePopup(aImageNode);
    this._debugToConsole("ThumbnailZoomPlus: showed popup");
  },
  
  _clearIgnoreBBox : function() {
    this._logger.trace("_clearIgnoreBBox");
    // clear the previous 'ignore' region
    // so a future mouse move can re-enter it and re-popup.
    this._ignoreBBox.xMax = -999;
  },

  _setIgnoreBBoxPageRelative : function() {
    this._logger.trace("_setIgnoreBBoxPageRelative");
    this._ignoreBBox.xMin = this._thumbBBox.xMin;
    this._ignoreBBox.xMax = this._thumbBBox.xMax;
    this._ignoreBBox.yMin = this._thumbBBox.yMin;
    this._ignoreBBox.yMax = this._thumbBBox.yMax;
    this._ignoreBBox.refScrollLeft = this._thumbBBox.refScrollLeft;
    this._ignoreBBox.refScrollTop = this._thumbBBox.refScrollTop;
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
    
    // ff 15 warning: Error: TypeError: can't access dead object
    // when cliking the "Older" link in Engadget Mobile or when opening Tools > Addons.
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
  
  _applyPopupAvoider : function(available, flags) {    
    // Horizontal popup avoider:
    if (flags.popupAvoiderWidth > 0) {    
      let zoom = gBrowser.selectedBrowser.markupDocumentViewer.fullZoom;
      let availableForSitePopup = available.right +
                  (this._thumbBBox.xMax - this._thumbBBox.xMin + 1) * (1.0 - flags.popupAvoiderLREdge);
      if (availableForSitePopup > flags.popupAvoiderWidth * zoom) {
        // site's own popup would appear to right of thumb.
        flags.allowRight = false;
      }  else {
        flags.allowLeft = false;
      }
      this._logger.debug("_applyPopupAvoider: width availableForSitePopup=" +
                         availableForSitePopup + "; popupAvoiderWidth=" + 
                         flags.popupAvoiderWidth + "; scaled by zoom " + zoom + " = "
                         + (flags.popupAvoiderWidth * zoom) +
                         "allowLeft=" + flags.allowLeft +
                         "; allowRight=" + flags.allowRight);
    }
    
    // Vertical popup avoider:
    if (flags.popupAvoiderHeight > 0) {
      if (flags.popupAvoiderTBEdge == "midpage") {
        if (available.top > available.bottom) {
          // sites popup will be above thumb.
          flags.allowAbove = false;
        } else {
          flags.allowBelow = false;
        }
        this._logger.debug("_applyPopupAvoider: popupAvoiderTBEdge: midpage" +
                           "; allowAbove=" + flags.allowAbove +
                           "; allowBelow=" + flags.allowBelow);
      } else {
        let availableForSitePopup = 0;
        if (flags.popupAvoiderTBEdge == "below") {
          // site's preferred direction is below thumb.
          availableForSitePopup = available.bottom;
        } else if (flags.popupAvoiderTBEdge == "above") {
          // site's preferred direction is below thumb.
          availableForSitePopup = available.top;
        } else {
          this._logger.debug("_applyPopupAvoider: ERROR: popupAvoiderTBEdge: " +
                             flags.popupAvoiderTBEdge);
        }
        let siteUsesPreferred = (availableForSitePopup > flags.popupAvoiderHeight);
        if (siteUsesPreferred ^ (flags.popupAvoiderTBEdge == "below")) {
          // site's popup will be above since
          // either the site is using preferred side or preferred side is below
          // (but not both).  So allow our popup below but not above.
          flags.allowAbove = false;
        } else {
          flags.allowBelow = false;
        }
        this._logger.debug("_applyPopupAvoider: height availableForSitePopup=" +
                           availableForSitePopup + "; popupAvoiderHeight=" + 
                           flags.popupAvoiderHeight + "; allowAbove=" + flags.allowAbove +
                           "; allowBelow=" + flags.allowBelow);
      }
    }
  }, 
  
  /**
   * Returns the width of the larger of the space to the left or
   * right of the thumbnail, and the height of the larger of the space
   * above and below it.  This is the space into which the
   * image would have to fit if we displayed it to the side of or
   * above/below the thumbnail without overlapping it.
   *
   * @param aImageNode the image node.
   * @return An object with .left, .right, .top, .bottom, .windowWidth, 
   *    .windowHeight, .windowX, .windowY;
   *    .width and .height are the min of .left, .right and
   *    .top, .bottom, respectively.  All sizes are reduced by padding
   *    so that they reflect possible image size, not entire popup size.
   */
  _getAvailableSizeOutsideThumb : function(aImageNode, flags) {
    this._logger.trace("_getAvailableSizeOutsideThumb");
    let pageZoom = gBrowser.selectedBrowser.markupDocumentViewer.fullZoom;

    let maxSizePref = ThumbnailZoomPlus.getPref(this.PREF_PANEL_POPUP_SIZE, 
                                                this.PREF_VALUE_POPUP_SIZE_WEB_PAGE);

    if (maxSizePref == this.PREF_VALUE_POPUP_SIZE_SCREEN) {
      // fit within screen (excluding areas marked as disallowed, such as
      // the menubar on mac or task bar on Windows)
      var pageX = window.screen.availLeft;
      var pageY = window.screen.availTop;
      var pageWidth = window.screen.availWidth;
      var pageHeight = window.screen.availHeight;
      
    } else if (maxSizePref == this.PREF_VALUE_POPUP_SIZE_WINDOW) {
      // Fit within the entire firefox window (eg covering toolbars)
      var pageX = window.screenX;
      var pageY = window.screenY;
      var pageWidth  = window.outerWidth;
      var pageHeight = window.outerHeight;
    
    } else {
      // assume this.PREF_VALUE_POPUP_SIZE_WEB_PAGE
      // fit within the web page's screen area.
      var pageX = content.window.mozInnerScreenX * pageZoom;
      var pageY = content.window.mozInnerScreenY * pageZoom;
      var pageWidth = content.window.innerWidth * pageZoom;
      var pageHeight = content.window.innerHeight * pageZoom;
    }
    
    this._logger.debug("_getAvailableSizeOutsideThumb: window at (" +
                       pageX + "," + pageY +
                       ") " + pageWidth + " x " + pageHeight);
    
    /*
     * pageLeft is the space available to the left of the thumb. 
     * pageTop is the space available above it.
     */
    let available = {left:0, right:0, top:0, bottom: 0,
                     windowWidth: pageWidth,
                     windowHeight: pageHeight,
                     windowX: pageX, windowY: pageY};

    available.left = this._thumbBBox.xMin - pageX;
    available.top = this._thumbBBox.yMin - pageY;
    
    /*
     * pageRight is the space available to the right of the thumbnail,
     * and pageBottom the space below.
     */
    available.right = pageWidth - available.left - aImageNode.offsetWidth * pageZoom;
    available.bottom = pageHeight - available.top - aImageNode.offsetHeight * pageZoom;

    this._applyPopupAvoider(available, flags);
    
    if (!flags.allowLeft) available.left = 0;
    if (!flags.allowRight) available.right = 0;
    if (!flags.allowAbove) available.top = 0;
    if (!flags.allowBelow) available.bottom = 0;
    
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
                       
    // adjust the widths and heights which apply if the image were placed
    // to the left, right, top, or bottom of the thumb, or in the entire window.
    // In all cases we adjust by [xy]adjutment, which accounts for extra
    // space on both sides of the popup.
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
   * @return the scale dimensions and position in these fields:
   *   {width: displayed width of image
   *    height: displayed height of image 
   *    allow: boolean; true if we allow the popup; false if disallowed since
   *           would be too small.
   *   }
   */
  _getScaleDimensions : function(imageWidth, imageHeight, available, 
                                 flags, thumbWidth, thumbHeight) {
    this._logger.trace("_getScaleDimensions");

    let changedScaleTemporarily = this._currentMaxScaleBy != this._getDefaultScalePref();
    let scaleRatio = (imageWidth / imageHeight);
    
    let scaleUpBy = this._currentMaxScaleBy;
    let pageZoom = gBrowser.selectedBrowser.markupDocumentViewer.fullZoom;
    if (pageZoom > 1.0 &&
        pageZoom > scaleUpBy &&
        ! changedScaleTemporarily) {
      // If the page is zoomed up to greater than 100%, allow the popup to
      // be zoomed up that much too.  TODO: is this logic needed, or can
      // the user accomplish that by increasing TZP's zoom preference?
      scaleUpBy = pageZoom;
    }
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
                       scale.width + " x " + scale.height);

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
    if (! this._currentAllowCoverThumb) {
      this._logger.debug("_getScaleDimensions: disallowing covering thumb because of pref");
      scale = sideScale;
    } 

    if (flags.popupAvoiderWidth > 0) {
      // allowing to cover thumb may also cover site's popup, so disallow.
      // TODO: this is overly strict since a covering popup wouldn't
      // always cover the site's popup.
      this._logger.debug("_getScaleDimensions: disallowing covering thumb because popupAvoiderWidth");
      scale = sideScale;
    } 

    this._logger.debug("_getScaleDimensions: _currentMaxScaleBy=" + this._currentMaxScaleBy +
                       "; _getDefaultScalePref()=" + this._getDefaultScalePref() +
                       "; so changedScaleTemporarily=" + changedScaleTemporarily);
    if (! changedScaleTemporarily) {
      // Allow showing the popup only if popup size is at least 12% bigger
      // than thumb.
      scale.allow = (scale.width >= thumbWidth * 1.12 ||
                     scale.height >= thumbHeight * 1.12);
      sideScale.allow = scale.allow;
      if (! scale.allow) {
        this._logger.debug("_getScaleDimensions: skipping: popup image size (" +
                           scale.width + " x " + scale.height + 
                           ") isn't at least 12% bigger than thumb (" +
                           thumbWidth + " x " + thumbHeight + ")");
      }
      if (scale.allow &&
          (imageWidth < flags.minImageWidth ||
           imageHeight < flags.minImageHeight  ) ) {
        this._logger.debug("_getScaleDimensions: skipping: raw image size (" +
                           imageWidth + " x " + imageHeight + 
                           " < min of " + 
                           flags.minImageWidth + " x " + flags.minImageHeight);
        scale.allow = false;
      }
      if (scale.allow && 
          this._currentAllowCoverThumb &&
          scale.width < sideScale.width * 1.12 &&
          sideScale.width > thumbWidth * 1.12) {
        // Disallow covering thumb if it doesn't make the image at least 12%
        // bigger -- but do allow covering even then, if not covering
        // would make the popup less than 12% bigger than the thumb.
        this._logger.debug("_getScaleDimensions: disallowing covering " + 
                           "thumb because covering width " + scale.width +
                           " isn't at least 12% bigger than uncovered width " +
                           sideScale.width);
        scale = sideScale;
      }
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
    
    // Note that pageWidth and pageHeight were already reduced by 
    // _pad and _widthAddon and _captionHeight as appropriate, so that they
    // reflect the space available for the image itself, not counting its padding or border.
    let pageWidth = available.windowWidth;
    let pageHeight = available.windowHeight;
    
    let windowStartX = available.windowX;
    let windowStartY = available.windowY;
    
    // popupWidth and height are the size of the image which we'll display.
    // Note that these were already reduced due to this._widthAddon if necessary 
    // to allow the image plus its border to fit in the available space.  
    // PopupHeight doesn't include the additional height due to captionHeight.
    let popupWidth = imageSize.width;
    let popupHeight = imageSize.height;
    let captionHeight = wantCaption ? this._captionHeight : 0;
      
    // padding is pixels of padding between the thumb or window edge and
    // the popup, on one side of width or height of the image.
    // Note that it doesn't include the border's size this._widthAddon since
    // we've already adjusted popupWidth and popupHeight for it.
    let padding = this._pad;
    
    if (imageSize.height <= available.height) {
      // Position above or below thumb.
      // We prefer above/below thumb to avoid tooltip.
      // Unless we're prohibited from positioning to the right,
      // position the popup horizontally flush with the right of the window or
      // left-aligned with the left of the thumbnail, whichever is left-most.
      if (available.right > 0) {
        let popupXPageCoords = pageWidth - popupWidth + padding;
        var popupXScreenCoords = popupXPageCoords + windowStartX;
        popupXScreenCoords = Math.min(popupXScreenCoords, 
                                      this._thumbBBox.xMin);
      } else {
        // Align right edge of popup with right edge of thumb (if possible).
        var popupXScreenCoords = this._thumbBBox.xMax - popupWidth;
        popupXScreenCoords = Math.max(popupXScreenCoords, windowStartX);
      }
      pos.x = popupXScreenCoords;
      this._logger.debug("_calcPopupPosition: " +
                         "windowStartX=" + windowStartX +
                         "; pageWidth=" + pageWidth +
                         "; popupXScreenCoords=" + popupXScreenCoords);

      if (imageSize.height <= available.top) {
        this._logger.debug("_calcPopupPosition: display above thumb"); 
        pos.y = this._thumbBBox.yMin - padding - popupHeight - captionHeight
                - this._widthAddon;
      } else {
        this._logger.debug("_calcPopupPosition: display below thumb"); 
        pos.y = this._thumbBBox.yMax + padding;
      }
    } else if (imageSize.width <= available.width) {
      // Position to the left or right of the thumb.
      // We prefer left-of thumb to right-of thumb since tooltip
      // typically extends to the right.
      
      // Position the popup vertically flush with the bottom of the window or
      // top-aligned with the top of the thumbnail, whichever is higher.
      // We don't simply use a 0 offset and rely on Firefox's logic since
      // on Windows that can position the thumb under an always-on-top
      // Windows task bar.
      let popupYPageCoords = pageHeight - popupHeight + padding;
      let popupYScreenCoords = popupYPageCoords + windowStartY;
      popupYScreenCoords = Math.min(popupYScreenCoords, this._thumbBBox.yMin);
      pos.y = popupYScreenCoords;
      this._logger.debug("_calcPopupPosition: " +
                         "windowStartY=" + windowStartY +
                         "; pageHeight=" + pageHeight +
                         "; popupYPageCoords=" + popupYPageCoords +
                         "; popupYScreenCoords=" + popupYScreenCoords);
      if (imageSize.width <= available.left) {
        this._logger.debug("_calcPopupPosition: display to left of thumb"); 
        pos.x = this._thumbBBox.xMin - padding - popupWidth  - captionHeight 
                - this._widthAddon;
      } else {
        this._logger.debug("_calcPopupPosition: display to right of thumb"); 
        pos.x = this._thumbBBox.xMax + padding;
      }
    } else {
      // cover thumb (at least partially).  Center in window for any dimensions
      // where the thumb will be totally covered.  For any which only parially
      // cover it, allow thumb to be partially visible.

      // First calc centered position:
      pos.x = windowStartX + (available.windowWidth - popupWidth) / 2 + padding;
      pos.y = windowStartY + (available.windowHeight - popupHeight) / 2 + padding;

      this._logger.debug("_calcPopupPosition: " +
                         "overlap thumb.  start x,y which centers image over thumb = " +
                         pos.x + "," + pos.y);

      // openSize is the amount of available width which isn't covered by the
      // popup.
      let openSize = available.windowWidth - popupWidth;
      this._logger.debug("_calcPopupPosition: " +
                         "available.width = " + available.width +
                         " vs openSize width = " + openSize);
      if (available.left  < openSize ||
          available.right < openSize) {
        // Part of the thumb could be visible horizontally.  Make it so.
        // Typically happens with horizontally-long links, e.g. on reddit.com
        if (available.left < available.right) {
          // There is less free space to the left of the thumb; thus the
          // thumb is closer to the left edge of the window, and
          // we should position against right edge of window
          pos.x = windowStartX + (available.windowWidth - popupWidth)
                  + padding;
          this._logger.debug("_calcPopupPosition: " +
                             "position against right edge of window.  x = " +
                              pos.x);
        } else {
          // position against left edge of window.
          pos.x = windowStartX + padding;
          this._logger.debug("_calcPopupPosition: " +
                             "position against left edge of window.  x = " +
                              pos.x);
        }
      }
      
      // openSize is the amount of available height which isn't covered by the
      // popup.
      openSize = available.windowHeight - popupHeight;
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
          pos.y = windowStartY + (available.windowHeight - popupHeight)
                  + padding;
          this._logger.debug("_calcPopupPosition: " +
                             "position against bottom edge of window.  y = " +
                              pos.y);
        } else {
          // position against top edge of window.
          pos.y = windowStartY + padding;
          this._logger.debug("_calcPopupPosition: " +
                             "position against top edge of window.  y = " +
                              pos.y);
        }
      }
    }
    this._logger.debug("_calcPopupPosition: positioning at (" + pos.x + 
                      ", " + pos.y + ")");

    return pos;
  },
  
  _setExactSize : function(element, w, h) {
    element.style.minWidth = w + "px";
    element.style.width    = w + "px";
    element.style.maxWidth = w + "px";

    element.style.minHeight = h + "px";
    element.style.height    = h + "px";
    element.style.maxHeight = h + "px";
  },
  
  _clearSize : function(element, w, h) {
    element.style.minWidth = "0";
    element.style.width    = "auto";
    element.style.maxWidth = "none";

    element.style.minHeight = "0";
    element.style.height    = "auto";
    element.style.maxHeight = "none";
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

    // Set the size of the image and its surrounding div.  Tests indicate
    // that doing clearSize() on the div wouldn't work; it'd leave a few extra
    // pixels of spacing below the image.
    this._setExactSize(this._panelHtmlImage, aScale.width, aScale.height);
    this._setExactSize(this._panelXulImage, aScale.width, aScale.height);
    this._setExactSize(this._panelImageDiv, aScale.width, aScale.height);
    
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
        "thumbnailzoomplus-options-window", "chrome,titlebar,toolbar,centerscreen,resizable");
    optionsDialog.focus();
  },


  /**
   * Opens the help in a new tab.  This is used when opening help from
   * the toolbar button, but not the Preferences dialog (the latter uses
   * a direct html link).
   */
  openHelp : function() {
    this._logger.debug("openHelp");

    let helpURL = "http://thumbnailzoomplus.wordpress.com/";

    let tab = openUILinkIn(helpURL, "tab");
    gBrowser.selectedTab = tab;
    
  },

  _endsWith : function(str, suffix) {
    let endsWith = str.indexOf(suffix, str.length - suffix.length) !== -1;
    this._logger.debug("_endsWith('"+str+"','"+suffix+"')="+endsWith);
    return endsWith;
  },

  _friendlyTruncate : function(s, maxChars, minChars) {    
    if (s.length <= maxChars) {
      return s;
    }
    if (minChars < 0) minChars = 0;
    let separators = /[\W_]/;
    for (let i=maxChars; i >= minChars; --i) {
      let c = s.substring(i, i+1);
      if (separators.test(c)) {
        // position i is a separator; return fname up to but excluding that point.
        return s.substring(0, i);
        break;
      }
    }

    // Couldn't find a word break giving a string at least minChars long;
    // truncate without regard to word breaks.
    return s.substring(0, maxChars);
  },
  
  _getDefaultFilename : function(basename, extension) {
    var caption = this._caption || "";
    var shortCaption = this._friendlyTruncate(caption, 22, 22 - 6);
    var pref = ThumbnailZoomPlus.getPref(this.PREF_PANEL_SAVE_FILENAME, "caption");

    var separator = "";
    if (shortCaption && basename) {
      separator = "_";
    }
    if ("web" == pref) {
      var name = basename;
    
    } else if ("caption+web" == pref) {
      var name = shortCaption + separator + basename;
    
    } else if ("web+caption" == pref) {
      var name = basename + separator + shortCaption;
    
    } else {
      // "caption"
      var name = caption;
    }
    if (name == "") {
      name = "image";
    }
    
    // Change ms windows reserved chars to -
    name = name.replace(/[\000-\031\/~\\:<>"|?*]+/g, '-');
    // fix syntax highlighting: "
    
    // For the mac prohibit '.' at the start.
    // And starting with certain chars just looks bad.
    name = name.replace(/^[\._ -]+/, '');
    
    // Limit length.
    let maxChars = 32;
    // Truncate after the last word break before position maxChars.
    name = this._friendlyTruncate(name, maxChars, maxChars - 12);
    if (extension && 
        !this._endsWith(name, '.' + extension)) {
      // Add file extension.
      if (! /\.$/.test(name)) {
        name += '.';
      }
      name += extension;
    }
    
    // For Windows doesn't allow ending with a space or period.
    name = name.replace(/[\. ]+$/, '');
    
    // Some Windows names are reserved, too:
    name = name.replace(/^com[1-9]|lpt[1-9]|con|nul|prn$/, '');

    return name;
  },
  
  /**
   * Downloads the full image.
   */
  downloadImage : function() {
    this._logger.trace("downloadImage");

    if (null == this._currentImage) {
      this._logger.debug("downloadImage: no _currentImage");
      return;
    }
    
    let imageURL = this._currentImage;
    let filePickerResult = null;
    
    // find extension
    // Get extension (without dot) for picker's defaultExtension.
    let fnameRE = /([^/\\\?\%]*?)\.([a-zA-Z0-9]{3,4})[^.]*$/;
    let match = fnameRE.exec(imageURL);
    let extension = (match && match[2] || "");
    let basename = (match && match[1] || imageURL || "");
    let pickerDefaultName = this._getDefaultFilename(basename, extension);
    this._logger.debug("downloadImage: default ext='" + extension +
                       "' from '" + pickerDefaultName + "'");

    let title = this.getEntity("save_image_title") + this._caption;
    this._filePicker.init(window, title, Ci.nsIFilePicker.modeSave);
    this._filePicker.appendFilters(Ci.nsIFilePicker.filterAll | Ci.nsIFilePicker.filterImages);
    this._filePicker.defaultString = pickerDefaultName;

    // On Windows, defaultExtension is an extension appended to the user's
    // entry if the user doesn't specify any extension (without a '.').
    this._filePicker.defaultExtension = extension;
    filePickerResult = this._filePicker.show();
    
    if (Ci.nsIFilePicker.returnOK == filePickerResult ||
        Ci.nsIFilePicker.returnReplace == filePickerResult) {
      let filePath = this._filePicker.file.path;
      this._logger.debug("downloadImage: picked '" + filePath +
                         "'; url='" + this._filePicker.fileURL.path
                         + "'");
      
      var win = null;
      if (this._currentThumb) {
        win = this._currentThumb.ownerDocument.defaultView;
      }
      ThumbnailZoomPlus.DownloadService.downloadImageAsOriginal(win, imageURL, filePath);
    }
  },

  _copyToClipboard : function(copyImage, copyImageURL) {
    this._logger.trace("copyToClipboard");

    if (null == this._currentImage) {
      this._logger.debug("copyToClipboard: no _currentImage");
      return;
    }
    ThumbnailZoomPlus.ClipboardService
        .copyImageToClipboard(this._currentWindow, this._currentImage, 
                              copyImage, copyImageURL);
  },
  

  /**
   * Toggles the preference value.
   * @param aPage the page constant.
   */
  togglePagePreference : function(aPage) {
    this._logger.trace("togglePagePreference");
    let pageName = ThumbnailZoomPlus.FilterService.getPageName(aPage);
    let menuItemId = "thumbnailzoomplus-toolbar-menuitem-" + pageName;
    let menuItem = document.getElementById(menuItemId);
    // get the new state
    // note: menuItem checkbox getting and setting is very subtle;
    // see Firefox docs https://developer.mozilla.org/en/XUL/PopupGuide/MenuItems
    let checked = menuItem.getAttribute("checked") == "true";

    let pagePrefKey = ThumbnailZoomPlus.PrefBranch + pageName + ".enable";
    this._logger.debug("set pref " + pagePrefKey + " to " + checked);
    ThumbnailZoomPlus.setPref(pagePrefKey, checked);
  },


  /**
   * Updates the pages menu.
   * @param aPage the page constant.
   */
  _updatePagesMenuItemElement : function(pageKey, menuItem) {
      let pageEnable = ThumbnailZoomPlus.isNamedPageEnabled(pageKey);
      this._logger.trace("_updatePagesMenuItemElement " + pageKey + " to " + pageEnable);
      // note: menuItem checkbox getting and setting is very subtle;
      // see Firefox docs https://developer.mozilla.org/en/XUL/PopupGuide/MenuItems
      if (pageEnable) {
        menuItem.setAttribute("checked", "true");
      } else {
        menuItem.setAttribute("checked", "false");
        menuItem.removeAttribute("checked");
      }
  },

  
  toggleEnable : function(target) {
    let menuButton = document.getElementById("thumbnailzoomplus-toolbar-button");
    if (target != menuButton) {
      return;
    }
    let enable = ThumbnailZoomPlus.togglePref(this.PREF_PANEL_ENABLE);
    this._logger.debug("toggleActive: enable=" + enable);
  },
  
  _updateMenuButtonState : function() {
    this._logger.trace("_updateMenuButtonState");
    let enable = ThumbnailZoomPlus.getPref(this.PREF_PANEL_ENABLE, true);
    
    // Set tool button state
    let menuButton = document.getElementById("thumbnailzoomplus-toolbar-button");
    this._logger.debug("_updateMenuButtonState: menuButton=" + menuButton);
    if (menuButton) {
      // Set the tzpenabled attribute, which triggers our CSS to show
      // the icon as enabled or disabled.
      menuButton.setAttribute("tzpenabled", enable);
    }
  },
  
  /**
   * Shows the panel border based in the preference value.
   */
  _showPanelBorder : function() {
    this._logger.trace("_showPanelBorder");

    let panelBorder = ThumbnailZoomPlus.getPref(this.PREF_PANEL_BORDER, true);

    if (panelBorder) {
      this._borderBox.removeAttribute("panelnoborder");
      this._widthAddon = this._borderWidth * 2;
    } else {
      this._borderBox.setAttribute("panelnoborder", true);
      this._widthAddon = 0;
    }
  },


  /**
   * Observes preference changes.
   * @param aSubject The object related to the change.
   * @param aTopic The topic being observed.
   * @param aData The data related to the change.
   */
  observePrefChange : function(aSubject, aTopic, aData) {
    this._logger.debug("observe: " + aTopic + " " + aData);
    this._logger.debug("observe: this._originalURI = " + this._originalURI);

    if ("nsPref:changed" == aTopic &&
        -1 != aData.indexOf(ThumbnailZoomPlus.PrefBranch)) {
      // This is a preferences changed notification.
      ThumbnailZoomPlus.clearPrefCacheItem(aData);

      switch (aData) {
        case this.PREF_PANEL_BORDER:
          this._showPanelBorder();
          break;
        case this.PREF_PANEL_ENABLE:
          this._updateMenuButtonState();
          break;
        case this.PREF_PANEL_CONTEXT_MENU: 
          this._contextMenu.hidden = ! ThumbnailZoomPlus.getPref(this.PREF_PANEL_CONTEXT_MENU, true);
      }
    }
  },
  
    
  _addToHistory : function(url) {    
    var win = null;
    if (this._currentThumb) {
      win = this._currentThumb.ownerDocument.defaultView;
    }
    if (ThumbnailZoomPlus.isPrivateBrowsing(win)) {
      return;
    }
    
    if (url.indexOf(" ") != -1   
        || url.split("?")[0].indexOf("..") != -1) {  
      this._logger.debug("_addToHistory: bad URL syntax");  
      return;  
    }  
    
    this._logger.debug("_addToHistory: ADDING '" + url + "'");  
    let ioService = Components.classes["@mozilla.org/network/io-service;1"]  
                          .getService(Components.interfaces.nsIIOService);
    let nsIURI = ioService.newURI(url, null, null);

    var asyncHistory = Components.classes["@mozilla.org/browser/history;1"]
                          .getService(Components.interfaces.mozIAsyncHistory);
    asyncHistory.updatePlaces({
                              uri: nsIURI,
                              visits: [{
                                       transitionType: Ci.nsINavHistoryService.TRANSITION_LINK,
                                       visitDate: Date.now() * 1000
                                       }]
                              });
  },
  
  _addItemsToHistory : function(url, imageSourceNode) {
    let allowRecordingHistory = ThumbnailZoomPlus.getPref(this.PREF_PANEL_HISTORY, false);
    if (! allowRecordingHistory) {
      this._logger.debug("_addItemsToHistory: history pref is off.");  
      return;
    }

    // Add the URL of the image we popped-up.
    this._addToHistory(url);
    
    // The image URL may be different than the URL which provoked it, e.g.
    // because a page rule transformed it.  Mark that original URL in
    // history so it'll turn purple on reddit.com, for example.
    this._logger.debug("_addItemsToHistory: imageSourceNode is <" + imageSourceNode.localName.toLowerCase() + ">");
    var url2 = ThumbnailZoomPlus.FilterService.getUrlFromNode(imageSourceNode, false);
    if (url2) {
      this._logger.debug("_addItemsToHistory: aImageNode raw URL = " + url2);
      url2 = ThumbnailZoomPlus.FilterService.applyBaseURI(imageSourceNode.ownerDocument, url2);
      if (url2 != url) {
        this._addToHistory(url2);
      }
    }
  },

  _debugToConsole : function(msg) {
    ThumbnailZoomPlus.debugToConsole(msg);
  }
  
};

window.addEventListener(
  "load", function() { ThumbnailZoomPlusChrome.Overlay.init(); }, false);
window.addEventListener(
  "unload", function() { ThumbnailZoomPlusChrome.Overlay.uninit(); }, false);
