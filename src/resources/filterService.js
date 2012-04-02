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

var EXPORTED_SYMBOLS = [];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.import("resource://thumbnailzoomplus/common.js");

/**
 * The Filter Service.
 */
ThumbnailZoomPlus.FilterService = {
  /* Pages info list. */
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
    
    // The next two must be last so they are lower priority.
    ThumbnailZoomPlus.Pages.Others,
    ThumbnailZoomPlus.Pages.Thumbnail
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

    // If this.popupAvoiderWidth > 0, then popup positioning avoids the
    // side (left/right) where the site's own popup is likely to be.
    // width is the width of the site's popup; .popupAvoiderLREdge is the percentage from
    // left to right where the site's popup starts (0=left, 1=right).
    // The presumption is that the site's popup tries to position to the right
    // of that edge if it fits, or else to the left of the thumb.
    //
    // Set popupAvoiderWidth by resizing the browser narrow until the site 
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
    this.requireImageBiggerThanThumb = true;
  },
  
  /**
   * Gets the host of the specified document (if it has one and the
   * protocol is supported by TZP); otherwise returns null.
   *
   * Caution: this routine is somewhat slow; avoid calling it more than
   * necessary.
   */
  getHostOfDoc : function(aDocument) {
    // If enableFileProtocol, then the add-on is enabled for file:// URLs
    // (typically used with the Others page type).  This is useful during
    // debugging, but we don't normally enable it in the released version
    // since we aren't sure if there might be subtle security risks.
    let enableFileProtocol = false;
    
    // Get location from document or image.
    // TODO: to really do this right we'd need to split part of
    // getImageSource up so we can properly find the image/link URL
    // even before we know the page.  Or else call getImageSource on
    // each aPage, if that's not too slow.
    let protocol = null;
    let host = null;
    if (aDocument.location) {
      host = aDocument.location.host;
      protocol = aDocument.location.protocol;
    }
    if (! host || !protocol) {
      let imageSource = aDocument.src;
      if (imageSource) {
        // this._logger.debug("    getHostOfDoc: trying loc from aDocument.src "
        //                   + imageSource);
        var ioService = Components.classes["@mozilla.org/network/io-service;1"]  
                            .getService(Components.interfaces.nsIIOService);
        var uri = ioService.newURI(imageSource, aDocument.characterSet, null);
        try {
          host = uri.host;
          protocol = uri.scheme + ":";
          if (! host || !protocol) {
            this._logger.debug("    getHostOfDoc: Reject; couldn't get host from doc.src " + 
                               imageSrc + "; got " + protocol + "//" + host);
            return null;
          }
        } catch (e) {
          // uri.host throws an exception when the thumb's image data is
          // embedded in the URL, e.g. from Google Images for very small images
          // (eg size 'icon') or from flickr.com thumbs on main page when 
          // not logged in, e.g.
          // data:image/jpeg;base64,/9j...
          this._logger.debug("getHostOfDoc: unable to get host or protocol: " + e);
        }
        uri = null;
      }
    }
    if (! host || !protocol) {
      this._logger.debug("    getHostOfDoc: Reject; couldn't get host from " + 
                         aDocument + "; got " + protocol + "//" + host);
      return null;
    }

    if (("http:" == protocol ||
         "https:" == protocol ||
         (enableFileProtocol && "file:" == protocol))) {
      return host;
    }
    this._logger.debug("    getHostOfDoc: Reject by protocol for " + 
                       protocol + "//" + host);
    return null;
  },

  testPageConstantByHost : function(host, aPage) {
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
    let name = "?";
    
    let host = this.getHostOfDoc(aDocument);
    if (host == null) {
      return pageConstant;
    }
    let pageCount = this.pageList.length;
    
    for (let i = startFromPage; i < pageCount; i++) {
      if (this.testPageConstantByHost(host, i)) {
        pageConstant = i;
        name = this.pageList[i].key;
        break;
      }
    }

    return pageConstant;
  },

  /**
   * Gets the page constant (index of pageList) by name.
   * @param aPageName the page name.
   * @return the page constant.
   */
  getPageConstantByName : function(aPageName) {
    this._logger.debug("getPageConstantByName");

    let pageCount = this.pageList.length;
    let pageConstant = -1;

    for (let i = 0; i < pageCount; i++) {
      if (this.pageList[i].key == aPageName) {
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

  _applyBaseURI : function(aDocument, url) {
    var ioService = Components.classes["@mozilla.org/network/io-service;1"]  
                      .getService(Components.interfaces.nsIIOService);
    var baseUri = ioService.newURI(aDocument.baseURI, aDocument.characterSet, null);
    var uri = ioService.newURI(url, aDocument.characterSet, baseUri);
    this._logger.debug("_applyBaseURI(" + aDocument.baseURI +
                                      ", " + url + ") = " + uri.spec);
    return uri.spec;
  },
  
  /**
   * Gets the image source, handle special cases.
   * @param aNode the html node.
   * @param aPage the page constant.
   * @return object with fields:
   *     node: the node from which imageURL was determined
   *     imageURL: string (null if not apply);
   *     noTooSmallWarning: boolean
   */
  getImageSource : function(aDocument, aNode, aPage) {
    let result = {imageURL: null, noTooSmallWarning: false, node: aNode};
    let pageInfo = this.pageList[aPage];
    this._logger.debug("getImageSource: page " + aPage + " " + pageInfo.key);

    // Get node name and class
    let imageNode = aNode;
    let nodeName = imageNode.localName.toLowerCase();
    let nodeClass = imageNode.getAttribute("class");
    this._logger.debug("getImageSource: aNode name=" + nodeName + "; src=" +
                       imageNode.getAttribute("src") + "; href=" + imageNode.getAttribute("href") +
                       "; backgroundImage=" + imageNode.style.backgroundImage +
                       "; class=" + nodeClass);
    let imageSource =  null;

    if ("img" == nodeName) {
      imageSource = aNode.getAttribute("src");
    }

    // Call getSpecialSource if needed and defined (DEPRECATED)
    if (null != imageSource && pageInfo.getSpecialSource) {
      imageSource = pageInfo.getSpecialSource(aNode, imageSource);
      imageNode = null;
      this._logger.debug("getImageSource: getSpecialSource returned " + imageSource);
    }
    
    // Call getImageNode if defined.
    if (pageInfo.getImageNode) {
      this._logger.debug("getImageSource: calling getImageNode for " +
                         "aNode=" + aNode + ", nodeName=" + nodeName +
                         ", nodeClass=" + nodeClass + ", imageSource=" + imageSource);
      imageNode = pageInfo.getImageNode(aNode, nodeName, nodeClass, imageSource);      
      if (imageNode != aNode) {
        // changed nodes.   If imageNode == null, we're shouldn't do a popup.
        // and we ignore if localName is null, as sometimes happens if the
        // returned node is the document itself (seen when reloading Google Images)
        imageSource = null; // we need to re-get imageSource.
        if (imageNode != null && imageNode.localName) {
          var nodeName = imageNode.localName;
          let nodeClass = imageNode.getAttribute("class");
          this._logger.debug("getImageSource: after getImageNode, name=" + nodeName + "; src=" +
                           imageNode.getAttribute("src") + "; href=" + imageNode.getAttribute("href") +
                           "; backgroundImage=" + imageNode.style.backgroundImage +
                           "; class=" + nodeClass);
        } else {
          imageNode = null;
          this._logger.debug("getImageSource: after getImageNode, imageNode=null; name=" + nodeName + 
                             "; class=" + nodeClass);
        }
      } else {
        this._logger.debug("getImageSource: after getImageNode, node=" + imageNode);
      }
    }
    
    /*
    if (imageSource == null && pageInfo.getSpecialSource &&
        imageNode == aNode) {
      // this case is needed e.g. so Google search results don't show popups,
      // since its getSpeialSource returns null in that situation.
      this._logger.debug("getImageSource: ignoring: no imageSource after getSpecialSource & getImageNode didn't change node");
      result.imageURL = null;
      return result;
    }
    */
    
    // If don't have imageSource yet, get from src, href, or backgroundImage.
    if (null == imageSource && imageNode != null) {
      if (imageNode.hasAttribute("src")) {
        imageSource = imageNode.getAttribute("src");
        this._logger.debug("getImageSource: got image source from src attr of " + imageNode);
        
      } else if (imageNode.hasAttribute("href")) {
        // for an <a href=> node, use javascript string conversion rather
        // than retrieving the html attribute so it'll apply the base
        // document's URL for missing components of the URL (eg domain).
        imageSource = String(imageNode);
        this._logger.debug("getImageSource: got image source from href of " + imageNode);
        if (/^https?:\/\/t\.co\//.test(imageSource)) {
          // Special case for twitter http://t.co links; the actual
          // URL is in the link's tooltip.
          imageSource = imageNode.title;
        }
        
      } else {
        let backImage = imageNode.style.backgroundImage;
            
        if (backImage && "" != backImage && ! /none/i.test(backImage)) {
          this._logger.debug("getImageSource: got image source from backgroundImage of " + imageNode);
          imageSource = backImage.replace(new RegExp("url\\(\"", "i"), "")
                                 .replace(new RegExp("\"\\)"), "");
        }
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
      ThumbnailZoomPlus.Pages._logger.debug(
            "getImageSource: ignoring due to node type '" + nodeName + "'");
      imageSource = null;
    } 

    if (imageSource != null) {
      imageSource = this._applyBaseURI(aDocument, imageSource);
    }
    this._logger.debug("getImageSource: using image source       " + imageSource +
                       "; noTooSmallWarning=" + result.noTooSmallWarning);
    
    result.imageURL = imageSource;
    result.node = imageNode;
    
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

    let validImage = false;
    let exp = this.pageList[aPage].imageRegExp;
    let regExp = new RegExp(exp);

    if (regExp.test(aImageSrc)) {
      validImage = true;
    } else {
      this._logger.debug("ThumbnailPreview: filterImage rejected " + aImageSrc + " using " + exp);
    }

    return validImage;
  },

  /**
   * Gets the zoomed image source.
   * @param aImageSrc the image source url.
   * @param flags: an object which this function may modify.  Members:
   *   .allowLeft, .allowRight, .allowAbove, .allowBelow
   * @param aPage the filtered page.
   * @return the zoomed image source, null if none could be found, or "" if
   *  one was found, but for a site which the user disabled.
   */
  getZoomImage : function(aImageSrc, node, flags, aPage) {
    this._logger.debug("getZoomImage");

    let pageInfo = this.pageList[aPage];
    let zoomImage = pageInfo.getZoomImage(aImageSrc, node, flags);
    this._logger.debug("ThumbnailPreview: getZoomImage returned flags allow:" +
                       (+flags.allowLeft) + "<>" + (+flags.allowRight) +
                       " " + (+flags.allowAbove) + "^/v" + (+flags.allowBelow) +
                       " " + zoomImage);

    if (! /^https?:\/\/./i.test(zoomImage)) {
      // As a security precaution, we only allow http and https.
      this._logger.debug("ThumbnailPreview: rejecting URL not beginning with http or https");
      return null;
    }
    
    return zoomImage;
  }
};

/**
 * Constructor.
 */
(function() { this._init(); }).apply(ThumbnailZoomPlus.FilterService);
