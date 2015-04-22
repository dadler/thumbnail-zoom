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

var EXPORTED_SYMBOLS = [];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.import("resource://thumbnailzoomplus/common.js");

/**
 * The Filter Service.
 */
ThumbnailZoomPlus.FilterService = {
  /**
   * Pages info list. 
   *
   * The order in this list determines the priority order items are applied 
   * (first matching rule wins) and the order they appear in the toolbar
   * menu.
   */
  pageList : [
    ThumbnailZoomPlus.Pages.Amazon, // 0
    ThumbnailZoomPlus.Pages.DailyMile,
    ThumbnailZoomPlus.Pages.DeviantART,
    ThumbnailZoomPlus.Pages.Engadget,
    ThumbnailZoomPlus.Pages.Facebook,
    ThumbnailZoomPlus.Pages.Flickr, // 5
    ThumbnailZoomPlus.Pages.Fotop,
    ThumbnailZoomPlus.Pages.GMail, // before Google so it takes priority.
    ThumbnailZoomPlus.Pages.GooglePlus, // before Google so it takes priority.
    ThumbnailZoomPlus.Pages.Google,
    ThumbnailZoomPlus.Pages.Hi5,
    ThumbnailZoomPlus.Pages.IMDb,
    ThumbnailZoomPlus.Pages.Imgur, // 12
    ThumbnailZoomPlus.Pages.LastFM,
    ThumbnailZoomPlus.Pages.LinkedIn,
    ThumbnailZoomPlus.Pages.MySpace,
    ThumbnailZoomPlus.Pages.Netflix,
    ThumbnailZoomPlus.Pages.OkCupid,
    ThumbnailZoomPlus.Pages.PhotoBucket,
    ThumbnailZoomPlus.Pages.Pinterest,
    ThumbnailZoomPlus.Pages.Photosight, // 20
    ThumbnailZoomPlus.Pages.Picasa,
    ThumbnailZoomPlus.Pages.Tagged,
    ThumbnailZoomPlus.Pages.Twitpic,
    ThumbnailZoomPlus.Pages.Twitter,
    ThumbnailZoomPlus.Pages.YouTube, // 25
    ThumbnailZoomPlus.Pages.Wikipedia,
    
    // These must be last so they are lower priority.
    ThumbnailZoomPlus.Pages.Others,

    // We order these as Thumbnail, OthersIndirect, ThumbnailItself.  This 
    // way showing an enlarged version of the low-rez thumb (i.e. ThumbnailItself)
    // is lower priority than showing an image from the linked page, and showing
    // a high-rez image derived from the thumb is higher priority than
    // the slower OthersIndirect rule (eg for dailymotion.com where both rules
    // are available). 
    ThumbnailZoomPlus.Pages.Thumbnail,
    ThumbnailZoomPlus.Pages.OthersIndirect,
    ThumbnailZoomPlus.Pages.ThumbnailItself
  ],

  /* Logger for this object. */
  _logger : null,

  /**
   * Initializes the resource.
   */
  _init : function() {
    this._logger = ThumbnailZoomPlus.getLogger("ThumbnailZoomPlus.FilterService");
    this._logger.trace("_init");
    
    let pageCount = this.pageList.length;
    
    for (let i = 0; i < pageCount; i++) {
      this.pageList[i].aPage = i;
    }
  },

  /*
   * PopupFlags is a class representing options affecting how the
   * popup will be displayed.  Instantiate like this:
   *  flags = new PopupFlags()
   */
  PopupFlags : function() {
    this.allowLeft = true;
    this.allowRight = true;
    this.allowAbove = true;
    this.allowBelow = true;
    this.linkSameAsImage = false;
    
    // If this.popupAvoiderWidth > 0, then popup positioning avoids the
    // side (left/right) where the site's own popup is likely to be.
    // width is the width of the site's popup; .popupAvoiderLREdge is the percentage from
    // left to right where the site's popup starts (0=left, 1=right).
    // The presumption is that the site's popup tries to position to the right
    // of that edge if it fits, or else to the left of the thumb.
    //
    // Determine popupAvoiderWidth by resizing the browser narrow until the site 
    // just starts showing its popup to the left; then look at the TZP
    // debug messages to find the corresponding availableForSitePopup value.
    this.popupAvoiderWidth = 0;
    this.popupAvoiderLREdge = 0;

    // Similarly for vertical.  
    // popupAvoiderTBEdge indicates site's preferred popup location:
    // "above", "below", or "midpage" (i.e. above iff thumb is below page's
    // midpoint).  For pagemid, set popupAvoiderHeight to 1.
    this.popupAvoiderHeight = 0;
    this.popupAvoiderTBEdge = "unspecified";
    
    // Popup won't be shown if raw image size is smaller than this:
    this.minImageWidth = 30;
    this.minImageHeight = 15;
    
    this.noTooSmallWarning = false;
    this.noErrorIndicator = false;
    this.requireImageBiggerThanThumb = true;
    
    // captionPrefix is prepended to the caption, e.g. to show "[gallery] "
    // on imgur.com/a/
    this.captionPrefix = "";
    
    // color override of the optional border around the pop-up (as a CSS color string)
    this.borderColor = null;
    
    // imageSourceNode is the URL of the thumb or link which the user
    // hovered over (not necessarily the URL of the popup we ended up displaying).
    // This is useful so we can record it in the browser's history.
    // Should never be null if we've found an image to pop-up.
    this.imageSourceNode = null;
    
    this.setVideoBorderColor = function(url, comment) {
        this.borderColor = "#CC181E"; // youtube red
        ThumbnailZoomPlus.debugToConsole("setVideoBorderColor: due to '" + comment + "' for " + url);
    };
  },
  
  _allowProtocol : function(protocol, strict) {
    if ("http:" == protocol || "https:" == protocol) {
      return true;
    }
    if (!strict && ("chrome:" == protocol || "data:" == protocol)) {
      // allow the hosting page to be in chrome://, e.g. for
      // extensions like PrevNextArrows and showmemore.
      return true;
    }
    
    return false;
  },
  
  allowProtocolOfURL : function(URLstring, strict) {
    var ioService = Components.classes["@mozilla.org/network/io-service;1"]
                            .getService(Components.interfaces.nsIIOService);
    var protocol = ioService.extractScheme(URLstring) + ":";
    if (this._allowProtocol(protocol, strict)) {
      return true;
    }
    this._logger.debug("    allowProtocolOfURL: Reject by protocol (strict=" + strict + ") for " +
                       URLstring + " protocol " + protocol);
    return false;
  },
  
  /**
   * Gets the host of the specified document (if it has one and the
   * protocol is supported by TZP); otherwise returns null.
   * If strict, then imposes stricter rules on the allowed protocol; use
   * this with images (as opposed to hosting pages).
   *
   * Caution: this routine is somewhat slow; avoid calling it more than
   * necessary.
   */
  getHostOfDoc : function(aDocument, strict) {    
    // Get location from document or image.
    // TODO: to really do this right we'd need to split part of
    // getImageSource up so we can properly find the image/link URL
    // even before we know the page.  Or else call getImageSource on
    // each aPage, if that's not too slow.
    let protocol = null;
    let host = null;
    if (aDocument.location) {
      try {
        host = aDocument.location.host;
        protocol = aDocument.location.protocol;
        //this._logger.debug("    getHostOfDoc: loc from aDocument.location = "
        //                   protocol + "//" + host);
      } catch (e) {
        // I've seen this exception when pressing 't' in Firefox 3.6.
        ThumbnailZoomPlus._logExceptionToConsole("getHostOfDoc: unable to get host or protocol (a)", e);
      }      
    }
    if (host == null || !protocol) {
      // Try to get from an image node's src attr.  TODO: should it also
      // try href?
      let imageSource = aDocument.src;
      if (imageSource) {
        //this._logger.debug("    getHostOfDoc: trying loc from aDocument.src "
        //                   + imageSource);
        var ioService = Components.classes["@mozilla.org/network/io-service;1"]  
                            .getService(Components.interfaces.nsIIOService);
        var uri = ioService.newURI(imageSource, aDocument.characterSet, null);
        try {
          protocol = uri.scheme + ":";
          if (!protocol || protocol == "data:") {
            this._logger.debug("    getHostOfDoc: Reject; couldn't get protocol " + 
                               imageSource + "; got " + protocol);
            return null;
          }
          this._logger.debug("protocol: " + protocol);
          host = uri.host;
          if (host == null) {
            this._logger.debug("    getHostOfDoc: Reject; couldn't get host from doc.src " + 
                               imageSource + "; got " + protocol + "//" + host);
            return null;
          }
        } catch (e) {
          // uri.host throws an exception when the thumb's image data is
          // embedded in the URL, e.g. from Google Images for very small images
          // (eg size 'icon') or from flickr.com thumbs on main page when 
          // not logged in, e.g.
          // data:image/jpeg;base64,/9j...
          ThumbnailZoomPlus._logExceptionToConsole("getHostOfDoc: unable to get host or protocol (b)", e);
        }
        uri = null;
      }
    }
    if (host == null || !protocol) {
      this._logger.debug("    getHostOfDoc: Reject; couldn't get host from " + 
                         aDocument + "; got " + protocol + "//" + host);
      return null;
    }

    if (this._allowProtocol(protocol, strict)) {
      return host;
    }
    this._logger.debug("    getHostOfDoc: Reject by protocol (strict=" + strict + ") for " + 
                       protocol + "//" + host);
    return null;
  },

  testPageConstantByHost : function(host, aPage) {
    let hostDisallowRegExp = this.pageList[aPage].hostDisallow;
    if (hostDisallowRegExp && hostDisallowRegExp.test(host)) {
      this._logger.debug("    testPageConstantByHost: REJECT  '" +
                         this.pageList[aPage].key + "' (" + aPage + ") for " + 
                         host +
                         " based on disallow regexp " + this.pageList[aPage].hostDisallow );
      return false;
    }
    let hostRegExp = this.pageList[aPage].host;
    if (hostRegExp.test(host)) {
      this._logger.debug("    testPageConstantByHost: FOUND  '" +
                         this.pageList[aPage].key + "' (" + aPage + ") for " + 
                         host +
                         " based on regexp " + this.pageList[aPage].host );
      return true;
    }
    this._logger.debug("    testPageConstantByHost: Reject '" +
                       this.pageList[aPage].key + "' (" + aPage + ") for " + 
                       host +
                       " based on regexp " + this.pageList[aPage].host );
    return false;
  },

  /**
   * Detects and gets the page constant.
   * @param aDocument the document object, which could be the document
   * of the entire web page or an image node or <a href=...> node.
   * @return the page constant or -1 if none matches.
   */
  getPageConstantByDoc : function(aDocument, startFromPage) {
    let pageConstant = -1;
    
    let host = this.getHostOfDoc(aDocument);
    if (host == null) {
      return pageConstant;
    }
    let pageCount = this.pageList.length;
    
    for (let i = startFromPage; i < pageCount; i++) {
      if (this.testPageConstantByHost(host, i)) {
        pageConstant = i;
        break;
      }
    }

    return pageConstant;
  },

  /**
   * Gets the page name.
   * @param aPageConstant the page constant.
   * @return the page constant name ("key").
   */
  getPageName : function(aPageConstant) {
    let name = this.pageList[aPageConstant].key;
    this._logger.debug("getPageName " + aPageConstant + " = " + name);
    return name;
  },

  /**
   * Verify if the page is enabled.
   * @param aPage the page constant.
   * @return true if the page is enabled, false otherwise.
   */
  isPageEnabled : function(aPage) {
    // this._logger.debug("isPageEnabled " + aPage);

    let pageEnable = false;
    let pageName = this.getPageName(aPage);

    if (null != pageName) {
      pageEnable = ThumbnailZoomPlus.isNamedPageEnabled(pageName);
    }

    return pageEnable;
  },

  /**
   * Toggles the value of the page if enabled.
   * @param aPage the page constant.
   */
  togglePageEnable : function(aPage) {
    this._logger.debug("togglePageEnable " + aPage);

    let pageName = this.getPageName(aPage);

    if (null != pageName) {
      let pageEnable = ThumbnailZoomPlus.isNamedPageEnabled(pageName);

      let pagePrefKey = ThumbnailZoomPlus.PrefBranch + pageName + ".enable";
      ThumbnailZoomPlus.setPref(pagePrefKey, !pageEnable);
    }
  },
  
  /**
   * applyBaseURI applies the specified document's base URL to fill in
   * missing parts of url.  The returned value is a complete absolute URL.
   * For aDocument you may find it convenient to use elementNode.ownerDocument.
   */
  applyBaseURI : function(aDocument, url) {
    return this._applyThisBaseURI(aDocument, aDocument.baseURI, url);
  },
  
  _applyThisBaseURI : function(aDocument, baseURI, url) {
    var ioService = Components.classes["@mozilla.org/network/io-service;1"]  
                      .getService(Components.interfaces.nsIIOService);
    var baseUri = ioService.newURI(baseURI, aDocument.characterSet, null);
    var uri = ioService.newURI(url, aDocument.characterSet, baseUri);
    this._logger.debug("_applyThisBaseURI(" + baseURI +
                                      ", " + url + ") = " + uri.spec);
    return uri.spec;
  },
  
  getBackgroundImageURL : function(node) {
    let backImage = node.style.backgroundImage || "";
    let match = /url\(\"?(.+?)"?\)/.exec(backImage);
    if (match) {
      return match[1];
    }
    return null;
  },
  
  /**
   * getUrlFromNode returns a URL based on imageNode, using
   * the first of these rules which gives a non-blank URL:
   * 1. the node's src attribute (eg for <img>)
   * 2. the node's background-image style
   * 3. the node's href attribute (eg for <a>)
   * 4. the node's data-hovercard attribute (for Facebook.com profile links
   *    when logged out)
   * 5. return null
   *
   * If preferLinkOverThumb, it takes background-image has lower priority
   * than href.
   *
   * It also has special logic to handle t.co links.
   */
  getUrlFromNode : function(imageNode, preferLinkOverThumb) {
    let imageSource = this._getUrlFromNodeUnlimited(imageNode, preferLinkOverThumb);
    if (imageSource && imageSource.length > 1000) {
      // Very long URLs cause excessive slowness during regular expression checking,
      // and probably aren't useful URLs anyway, so we ignore them.  
      // Typically this prevents large
      // data:/ URLs from slowing Firefox down, e.g. in the "Share" popup dialog
      // of a Zynga game like "The Ville".
      return null;
    }
    return imageSource;
  },
  
  _getUrlFromNodeUnlimited : function(imageNode, preferLinkOverThumb) {
    let imageSource = null;
    
    if ("img" == imageNode.localName.toLowerCase() && imageNode.hasAttribute("src")) {
      imageSource = imageNode.getAttribute("src");
      this._logger.debug("getUrlFromNode: got image source from src attr of " + imageNode);
      return imageSource;
    }      
    if ("image" == imageNode.localName.toLowerCase() && imageNode.hasAttribute("href")) {
      // svg "image" node
      imageSource = imageNode.getAttribute("href");
      this._logger.debug("getUrlFromNode: got image source from src attr of " + imageNode);
      return imageSource;
    }      
    for (let caseNum = 0; caseNum <= 1; caseNum++) {
      switch (preferLinkOverThumb ? 1-caseNum : caseNum) {
      case 0:
        this._logger.debug("getUrlFromNode: trying background-image; preferLinkOverThumb=" +
                           preferLinkOverThumb);
        let backImage = imageNode.style.backgroundImage || "";
        let match = /url\(\"?(.+?)"?\)/.exec(backImage);
        if (match) {
          this._logger.debug("getUrlFromNode: got image source from backgroundImage: " + match[1]);
          return match[1];
        }
        break;
      
      case 1:
        this._logger.debug("getUrlFromNode: trying href; preferLinkOverThumb=" +
                           preferLinkOverThumb);
        if (imageNode.hasAttribute("href")) {
          // for an <a href=> node, use javascript string conversion rather
          // than retrieving the html attribute so it'll apply the base
          // document's URL for missing components of the URL (eg domain).
          imageSource = String(imageNode);
          this._logger.debug("getUrlFromNode: got image source from href of " + imageNode);
          if (/^https?:\/\/t\.co[\/]/.test(imageSource)) {
            // Special case for twitter http://t.co links; the actual
            // URL is in the link's tooltip.
            imageSource = imageNode.title;
          }
          return imageSource;
        }
        break;
      }
    }
    if (imageNode.hasAttribute("data-hovercard")) {
      return imageNode.getAttribute("data-hovercard");
    }
    
    return imageSource;
  },
  
  /**
   * Gets the image source, handle special cases.  Uses the page's
   * getImageNode().
   * @param aNode the html node.
   * @param aPage the page constant.
   * @return object with fields:
   *     node: the node from which imageURL was determined
   *     imageURL: string (null if not apply);
   *     noTooSmallWarning: boolean
   *     pageSpecificData: undefined or ...
   */
  getImageSource : function(aDocument, aNode, aPage) {
    let result = {imageURL: null, noTooSmallWarning: false, node: aNode};
    let pageInfo = this.pageList[aPage];
    this._logger.debug("getImageSource: page " + aPage + " " + pageInfo.key);

    // Get node name and class
    let imageNode = aNode;
    let nodeName = imageNode.localName.toLowerCase();
    let nodeClass = imageNode.className;
    this._logger.debug("getImageSource: aNode name=" + nodeName + "; src=" +
                       imageNode.getAttribute("src") + "; href=" + imageNode.getAttribute("href") +
                       "; backgroundImage=" + imageNode.style.backgroundImage +
                       "; class=" + nodeClass);
    
    /*
     * Get initial imageSource attempt from imageNode's image or link.
     */
    let preferLinkOverThumb = !!pageInfo.preferLinkOverThumb;
    let imageSource = this.getUrlFromNode(imageNode, preferLinkOverThumb);
    
    // Call getImageNode if defined.
    var pageSpecificData = {};
    if (pageInfo.getImageNode) {
      this._logger.debug("getImageSource: calling getImageNode for " +
                         "aNode=" + aNode + ", nodeName=" + nodeName +
                         ", nodeClass=" + nodeClass + ", imageSource=" + imageSource);
      imageNode = pageInfo.getImageNode(aNode, nodeName, nodeClass, imageSource, pageSpecificData);
      if (imageNode != aNode) {
        // changed nodes.   If imageNode == null, we're shouldn't do a popup.
        // and we ignore if localName is null, as sometimes happens if the
        // returned node is the document itself (seen when reloading Google Images)
        if (imageNode != null && imageNode.localName) {
          nodeName = imageNode.localName;
          nodeClass = imageNode.className;
          this._logger.debug("getImageSource: after getImageNode, name=" + nodeName + "; src=" +
                           imageNode.getAttribute("src") + "; href=" + imageNode.getAttribute("href") +
                           "; backgroundImage=" + imageNode.style.backgroundImage +
                           "; data-hovercard=" + imageNode.getAttribute("data-hovercard") +
                           "; class=" + nodeClass);
          imageSource = this.getUrlFromNode(imageNode, preferLinkOverThumb);
        } else {
          imageNode = null;
          imageSource = null; // disable.
          this._logger.debug("getImageSource: after getImageNode, imageNode=null");
        }
      } else {
        this._logger.debug("getImageSource: after getImageNode, unchanged node=" + imageNode);
      }
    }
    
    // Exclude very small embedded-data images, e.g. from google.com search field:
    // data:image/gif;base64,R0lGODlhAQABAID/AMDAwAAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw%3D%3D
    if (imageSource != null &
        /^data:/.test(imageSource) &&
        imageSource.length < 100) {
      this._logger.debug("getImageSource: ignoring small embedded-data image " +
                         imageSource);
      imageSource = null;
    }
      
    // Don't consider the source of an html doc embedded in an iframe to
    // be a thumbnail (eg gmail compose email body area).
    // Also don't consider a text input field (eg google search)
    // since it's probably just a minor graphic like a shadow.
    if ("html" == nodeName || "frame" == nodeName || "iframe" == nodeName ||
        "embed" == nodeName || "input" == nodeName) {
      this._logger.debug(
            "getImageSource: ignoring due to node type '" + nodeName + "'");
      imageSource = null;
    } 

    if (imageSource != null) {
      imageSource = this.applyBaseURI(aDocument, imageSource);
    }
    
    this._logger.debug("getImageSource: using image source       " + imageSource +
                       "; noTooSmallWarning=" + result.noTooSmallWarning);
    
    result.imageURL = imageSource;
    result.node = imageNode;
    result.pageSpecificData = pageSpecificData;
 
    return result;
  },

  /**
   * Filters an image source url.
   * @param aImageSrc the image source url.
   * @param aPage the page constant.
   * @return true if valid, false otherwise.
   */
  filterImage : function(aImageSrc, aPage) {
    this._logger.debug("filterImage");

    let page = this.pageList[aPage];
    let allowExp = new RegExp(page.imageRegExp);
    if (! allowExp.test(aImageSrc)) {
      this._logger.debug("ThumbnailPreview: filterImage REJECTED " + 
                        aImageSrc);
      this._logger.debug("ThumbnailPreview: " + 
                         "   REJECTED by imageRegExp: " + allowExp);
      return false;
    }
    this._logger.debug("filterImage: matched imageRegExp");

    if (page.imageDisallowRegExp) {
      var disallowExp = new RegExp(page.imageDisallowRegExp);
      if (disallowExp.test(aImageSrc)) {
        this._logger.debug("ThumbnailPreview: filterImage REJECTED " + 
                          aImageSrc);
        this._logger.debug("ThumbnailPreview: " + 
                           "   allowed by imageRegExp: " + allowExp);
        this._logger.debug("ThumbnailPreview: " +
                           "   REJECTED by imageDisallowRegExp: " + disallowExp);
        return false;
      }
    } else {
      var disallowExp = "(none)";
    }
    this._logger.debug("ThumbnailPreview: filterImage allowed " + aImageSrc);
    this._logger.debug("ThumbnailPreview: " + 
                       "   allowed by imageRegExp: " + allowExp);
    this._logger.debug("ThumbnailPreview: " +
                       "   allowed by imageDisallowRegExp: " + disallowExp);

    return true;
  },

  /**
   * Gets the zoomed image source, using the page's getZoomImage().
   * Sends the image source or array of image sources to the specified completionFunc
   * @param aImageSrc the image source url.
   * @param flags: an object which this function may modify.  Members:
   *   see PopupFlags() constructor above.
   * @param aPage the filtered page.
   * @param completionFunc: will be called with the image source or an
   *   array of them, and a
   *   flag which is true iff getting the zoom image is deferred.  Note that
   *   this call will come from getZoomImage if not deferred, or from
   *   somewhere else later if deferred.  Completion func returns a status
   *   string.
   *
   * @return a status string (such as "deferred").
   */
  getZoomImage : function(aImageSrc, node, flags, pageSpecificData, aPage, completionFunc) {
    this._logger.debug("getZoomImage");

    let pageInfo = this.pageList[aPage];
    
    let that = this;
    let pageCompletionFunc =  function(zoomImageResult) {
      that._logger.debug("ThumbnailPreview: getZoomImage deferred returned flags allow:" +
                     (+flags.allowLeft) + "<>" + (+flags.allowRight) +
                     " " + (+flags.allowAbove) + "^/v" + (+flags.allowBelow) +
                     " " + zoomImage);
      completionFunc(zoomImageResult, true);
    };      
    let zoomImage = pageInfo.getZoomImage(aImageSrc, node, flags, pageSpecificData,
                                          pageCompletionFunc);
      
    if (zoomImage == "deferred") {
      return zoomImage;
    }
    
    this._logger.debug("ThumbnailPreview: getZoomImage returned flags allow:" +
                       (+flags.allowLeft) + "<>" + (+flags.allowRight) +
                       " " + (+flags.allowAbove) + "^/v" + (+flags.allowBelow) +
                       " " + zoomImage);

    if (! /^https?:\/\/./i.test(zoomImage)) {
      // As a security precaution, we only allow http and https.
      this._logger.debug("ThumbnailPreview: rejecting URL not beginning with http or https");
      zoomImage = null;
    }
    
    return completionFunc(zoomImage, false);
  }
};

/**
 * Constructor.
 */
(function() { this._init(); }).apply(ThumbnailZoomPlus.FilterService);
