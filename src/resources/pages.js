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

// EXTS is a non-remembering expression which matches
// image file suffixes.
const EXTS = "(?:\\.gif|\\.jpe?g|\\.png|\\.bmp|\\.svg)";

Cu.import("resource://thumbnailzoomplus/common.js");

/**
 * Pages namespace
 */
if ("undefined" == typeof(ThumbnailZoomPlus.Pages)) {

  ThumbnailZoomPlus.Pages = {
    /* Logger for this object. */
    _logger : null,
    
    /**
     * Initializes the resource.
     */
    _init : function() {
      this._logger = ThumbnailZoomPlus.getLogger("ThumbnailZoomPlus.Pages");
      this._logger.trace("_init");
    }
  };
  ThumbnailZoomPlus.Pages._init();
};

/***********
  Define rules for each page.
  
  Each page is an object such as ThumbnailZoomPlus.Pages.Facebook, which
  is stored as an element in ThumbnailZoomPlus.FilterService.pageList[].

  Fields:

    * key: a unique lower-case string which identifies the rule in preferences
      and elsewhere.  eg "facebook"

    * name: user-visible rule name, often starting with captial letter.  Appears
      .g. in the tool menu's checkboxes.  eg "Facebook".

    * host: regular expression which the hostname of the page containing the
      thumbnail or link must match for the rule to apply.  THIS APPLIES
      TO THE PAGE WHICH HOSTS THE LINK OR THUMB, NOT THE IMAGE ITSELF.
      Remember to backslash-quote literal dots.  eg /^(.*\.)?facebook\.com$/

    * preferLinkOverThumb: optional boolean indicates that when the hovered
      node has both an href and a background-image, prefer to use the
      link rather than the background-image.  Defaults false.
    
    * imageRegExp: the popup image URL produced by the rule must match this 
      pattern or else it'll be rejected.  Helps prevent error icon from appearing
      due to generating an image URL which isn't really an image.
      Note that this is applied to the initial URL we have after getImageNode, 
      but before getZoom Image (which is kind of odd; maybe we should change it).
      eg /profile|\/app_full_proxy\.php|\.(fbcdn|akamaihd)\.net\/.*(safe_image|_[qstan]\.|([0-9]\/)[qsta]([0-9]))/

    * getImageNode: optional function(aNode, nodeName, nodeClass, imageSource).  
      Returns the node from which the popup image's link will be generated, or 
      null if the popup should be disabled (i.e. to REJECT the popup).  
      Useful when it's generated not from the direct thumbnail image, but an ancestor or
      peer node.  The image URL will be extracted (in fiterService.js) from the 
      returned node's src, href, or background image (assuming the return is
      different than aNode).  Note that imageSource may be null if the hovered
      node isn't an image or link.  The default function returns
      the image node itself.  
      
    * getZoomImage: required function(aImageSrc, node, popupFlags); returns the image URL.
      Translates the aImageSrc URL from the previous functions into the final
      URL of the full-size image for the popup, for example by
      removing ".thumb" from the URL.  Returns null if it can't produce a 
      valid full-size image URL from the specified aImageSrc, or "" if it
      can't because the user has disabled some other page related to the URL.
      Function can optionally modify members of flags, which is of class
      ThumbnailZoomPlus.FilterService.PopupFlags.  node is the node the user
      hovered, useful e.g. if you want to check its class.  You could decided
      to use a different (probably related) node, but note that getZoomImage
      won't even get called unless the hovered node has an image (otherwise
      you'd need to use getImageNode).  Also, if you use a different node,
      that node will not be considered by site enable flags.

    * aPage: the index of this page in 
      ThumbnailZoomPlus.FilterService.pageList[].  Not set in pages.js; 
      assigned by calculation in filterService.js.
      
 ***********/

/**
 * Facebook
 */
ThumbnailZoomPlus.Pages.Facebook = {
  key: "facebook",
  name: "Facebook",
  host: /^(.*\.)?facebook\.com$/,
  /*
     Thumb URLs seem different when logged into Facebook vs when logged out
     and refreshed.  When logged in I see akamaihd; when logged out I see fbcdn.
     test e.g. at https://www.facebook.com/Levis?sk=wall

     Example image URLs:
     https://s-external.ak.fbcdn.net/safe_image.php?d=AQBTSEn7MQEFZ1lI&w=90&h=90&url=http%3A%2F%2Fmy.eimg.net%2Fharvest_xml%2FNEWS%2Fimg%2F20111128%2Fa81e4575-1079-4efd-b650-59d72173f185.jpg
     https://fbcdn-photos-a.akamaihd.net/hphotos-ak-ash4/260453_10150229109580662_95181800661_7448013_4160400_s.jpg
     
     https://www.facebook.com/app_full_proxy.php?app=143390175724971&v=1&size=z&cksum=52557e63c5c84823a5c1cbcd8b0d0fe2&src=http%3A%2F%2Fupload.contextoptional.com%2F20111205180038358277.jpg
   */
  imageRegExp: /profile|\/app_full_proxy\.php|\.(fbcdn|akamaihd)\.net\/.*(safe_image|_[qstan]\.|([0-9]\/)[qstan]([0-9]))/,
  
  getImageNode : function(aNode, aNodeName, aNodeClass, imageSource) {
    if ("a" == aNodeName && "album_link" == aNodeClass) {
       aNode = aNode.parentNode;
    }
    if (/photoWrap|uiPhotoThumb|external/.test(aNodeClass)) {
      // In June 2012 FB started rolling out new photo layouts on the wall.
      // The dover detects a <div> and we need to find its child <img>.
      let imgNodes = aNode.getElementsByTagName("img");
      if (imgNodes.length > 0) {
        // take the first child.
        aNode = imgNodes[0];
      }
    }
    return aNode;
  },
  
  getZoomImage : function(aImageSrc, node, flags) {
    let aNodeClass = node.getAttribute("class");
    ThumbnailZoomPlus.Pages._logger.debug("facebook getZoomImage: node=" +
                                          node + "; class=" +
                                          aNodeClass);
    if (aNodeClass == "spotlight") {
      // Disable for lightbox view since popup covers tags in lightbox
      // image and comments, and lightbox image is already pretty large.
      return null;
    }
    if (aNodeClass && aNodeClass.indexOf("actorPic") >= 0) {
      // Don't show popup for small Facebook thumb of the person who's
      // entering a comment since the comment field loses focus and the 
      // thumbnails disappears, which is confusing.
      return null;
    }
    
    // Handle externally-linked images.
    let rexExternal = /.*\/safe_image.php\?(?:.*&)?url=([^&]+).*/;
    if (rexExternal.test(aImageSrc)) {
      aImageSrc = aImageSrc.replace(rexExternal, "$1");
      aImageSrc = decodeURIComponent(aImageSrc);
      return aImageSrc;
    }

    let appRex = /.*\/app_full_proxy.php\?.*&src=([^&]+)$/;
    if (appRex.test(aImageSrc)) {
      aImageSrc = aImageSrc.replace(appRex, "$1");
      aImageSrc = decodeURIComponent(aImageSrc);
      return aImageSrc;
    }
    
    aImageSrc = aImageSrc.replace(/_[qstan]\./, "_n.");
    aImageSrc = aImageSrc.replace(/([0-9]\/)[qsta]([0-9])/, "$1n$2");

    // https://fbcdn-sphotos-a.akamaihd.net/hphotos-ak-ash3/c0.0.133.133/p133x133/560586_10150817981981045_883718611_n.jpg becomes
    // https://fbcdn-sphotos-a.akamaihd.net/hphotos-ak-ash3/560586_10150817981981045_883718611_n.jpg
    // (handle the c0.0.133.133 part)
    aImageSrc = aImageSrc.replace(/\/c[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+(\/)/i, "/");

    let rex3 = new RegExp(/\/[sp][0-9]+x[0-9]+\//);
    aImageSrc = aImageSrc.replace(rex3, "/");

    if (/_q\./.test(aImageSrc)) {
      // Make sure we avoid positioning our popup will Facebook's wil be.
      flags.popupAvoiderTBEdge = "midpage"; 
      flags.popupAvoiderHeight = 1;
      flags.allowRight = false;
    } else if (/_n\./.test(aImageSrc)) {
      // These thumbs sometimes have a tooltip-like popup showing their
      // profile name above the image.
      flags.allowAbove = false;
    }

    return aImageSrc;
  }
};

/**
 * Twitter
 */
ThumbnailZoomPlus.Pages.Twitter = {
  key: "twitter",
  name: "Twitter",
  
  // We match anything with timg to catch things like twimg0-a.akamaihd.net
  host: /^(.*\.)?(twitter\.com$|twimg[.0-9-])/,
  imageRegExp: /(twitter\.com\/|twimg[.0-9-])/,
  getZoomImage : function(aImageSrc, node, flags) {
    let rex = new RegExp(/_(bigger|mini|normal|reasonably_small)(?![^.])/);
    let image = (rex.test(aImageSrc) ? aImageSrc.replace(rex, "") : null);
    return image;
  }
};

/**
 * Twitpic
 */
ThumbnailZoomPlus.Pages.Twitpic = {
  key: "twitpic",
  name: "Twitpic",   
  
  // Host includes twitter.com since twitter often hosts twitpic images.
  host: /^(.*\.)?(twitpic\.com|twitpicproxy.com|twitter\.com|twimg|skylin.es|picfog\.com|twicsy\.com)$/,
  imageRegExp:
    /^(.*[.\/])?(twimg[.0-9-].*|twitpic\.com(?:\/).*\/([a-z0-9A-Z]+)$|yfrog.com|api\.plixi\.com.*url=|photobucket\.com|instagr\.am|instagram\.com|twitpicproxy\.com|photozou.jp\/p\/img\/)/,

  getImageNode : function(node, nodeName, nodeClass, imageSource) {
    // If thumbnail-active-border-inner, the currently-selected thumbnail 
    // in slideshow view has a div
    // superimposed on it; find the corresponding img.
    // example: https://twitter.com/#!/TheRomMistress/media/slideshow?url=pic.twitter.com%2FfNwHmcGv
    if (nodeClass == "thumbnail-active-border-inner") {
      // Find child "img" nodes
      let imgNodes = node.parentNode.parentNode.getElementsByTagName("img");
      if (imgNodes.length > 0) {
        // take the last child.
        node = imgNodes[imgNodes.length-1];
      }
    }
    // If preview-hoverpart, then a popup on skylin.es
    if ("preview-hoverpart" == node.id) {
      // Find child "img" nodes
      let imgNodes = node.parentNode.getElementsByTagName("img");
      if (imgNodes.length > 0) {
        // take the last child.
        node = imgNodes[imgNodes.length-1];
      }
    }
    return node;
  },
    
  getZoomImage : function(aImageSrc, node, flags) {
    // lockerz, etc.:
    // http://api.plixi.com/api/tpapi.svc/imagefromurl?size=medium&url=http%3A%2F%2Flockerz.com%2Fs%2F198302791
    let rexPlixi = new RegExp("(.*/api\\.plixi\\.com/.*[?&])size=[a-z]+(.*)$");
    let rex1 = new RegExp(/[:_](thumb|bigger|mini|normal|reasonably_small)(?![^.])/);
    let rex2 = new RegExp(/-(mini|thumb)\./);
    // eg http://twitpic.com/show/mini/563w31; in this case mini and iphone exist but full doesn't.
    let rex3 = new RegExp(/\/(mini|thumb|iphone|large)\//);
    let rexInstagram = new RegExp("((instagr\\.am|instagram.com)/p/.*size)=[a-z]$");
    let rex4 = new RegExp(/\?size=t/);
    // yfrog: http://yfrog.com/gyw3xnpj:twthumb -> http://yfrog.com/gyw3xnpj:iphone
    // see also http://code.google.com/p/imageshackapi/wiki/YFROGurls
    let rex5 = new RegExp("(://yfrog\\..*):twthumb"); 
    // http://s235.photobucket.com/albums/ee124/snasearles/?action=view&current=IMAG0019.jpg ->
    // http://s235.photobucket.com/albums/ee124/snasearles/IMAG0019.jpg
    let rex6 = new RegExp("(\.photobucket\.com/albums/.*/)\\?.*=([a-z0-9]\\.[a-z0-9]+)", "i");
    let rexNoModNecessary = new RegExp(/(\/large\/|yfrog\.com|instagr\.am|lockers\.com|instagram.com|twimg|\.photobucket\.com\/albums|photozou\.jp\/p\/img\/)/);
    
    // photozou.jp:
    // http://photozou.jp/p/img/91576005 use as-is
    
    ThumbnailZoomPlus.Pages._logger.debug("getZoomImage twitpic p10: " + aImageSrc);

    /*
     * We could resolutions to "large".  Another option is "full", which is bigger,
     * but the server seems quite slow and "full" could take several seconds to
     * load even on a high-speed connection.
     * But some images have "full" size but not "large" size.
     * Ideally we'd try "large" but if it fails, try "full".
     * For now we use "full" to assure we get something, but it may be slow.
     */
    let image = null;
    
    if (rexPlixi.test(aImageSrc)) {
      ThumbnailZoomPlus.Pages._logger.debug("getZoomImage twitpic: rexPlixi");
      // See http://support.lockerz.com/entries/350297-image-from-url
      image = aImageSrc.replace(rexPlixi, "$1size=big$2");
    } 
    
    if (rex1.test(aImageSrc)) {
      ThumbnailZoomPlus.Pages._logger.debug("getZoomImage twitpic: rex1");
      image = aImageSrc.replace(rex1, "");

    } else if (rex2.test(aImageSrc)) {
      ThumbnailZoomPlus.Pages._logger.debug("getZoomImage twitpic: rex2");
      image = aImageSrc.replace(rex2, "-full.");

    } else if (rex3.test(aImageSrc)) {
      ThumbnailZoomPlus.Pages._logger.debug("getZoomImage twitpic: rex3");
      image = aImageSrc.replace(rex3, "/iphone/");

    } else if (rexInstagram.test(aImageSrc)) {
      ThumbnailZoomPlus.Pages._logger.debug("getZoomImage twitpic: rexInstagram");
      image = aImageSrc.replace(rexInstagram, "$1=l");

    }  else if (rex4.test(aImageSrc)) {
      ThumbnailZoomPlus.Pages._logger.debug("getZoomImage twitpic: rex4");
      image = aImageSrc.replace(rex4, "?size=f");

    } else if (rex5.test(aImageSrc)) {
      ThumbnailZoomPlus.Pages._logger.debug("getZoomImage twitpic: rex5");
      image = aImageSrc.replace(rex5, "$1:iphone");

    } else if (rex6.test(aImageSrc)) {
      ThumbnailZoomPlus.Pages._logger.debug("getZoomImage twitpic: rex6");
      image = aImageSrc.replace(rex6, "$1$2");

    } else if (rexNoModNecessary.test(aImageSrc)) {
      ThumbnailZoomPlus.Pages._logger.debug("getZoomImage twitpic: rexNoModNecessary");
      image = aImageSrc;
    }
    
    ThumbnailZoomPlus.Pages._logger.debug("getZoomImage twitpic p20: " + image);
    if (image == null) {
      return null;
    }

    // some twitpic images don't work with https so use http instead.
    image = image.replace(new RegExp("https://twitpic\\.com/"), "http://twitpic.com/");

    if (false) {
      // This is disabled because while it may sometimes help, more often it 
      // fails, adding .jpg where the image actually shouldn't have any suffix.
      // If we could return multiple filenames, we could use this logic.
      
      // If site is twimg or twitpic, make sure it has an image extension (.jpg default).
      // But not for profile_images, which actually sometimes don't have a suffix.
      let suffixRegex = new RegExp(EXTS, "i");
      if (/twitpic\.com|twimg/.test(image) &&
          ! suffixRegex.test(image) &&
          ! /\/profile_images\//.test(image)) {
        image += ".jpg";
      }
    }
    
    ThumbnailZoomPlus.Pages._logger.debug("getZoomImage twitpic p50: " + image);

    return image;
  }
};

/**
 * LinkedIn
 */
ThumbnailZoomPlus.Pages.LinkedIn = {
  key: "linkedin",
  name: "LinkedIn",
  host: /^(.*\.)?linkedin\.com$/,
  imageRegExp: /\/mpr\//,
  getZoomImage : function(aImageSrc, node, flags) {
    return aImageSrc.replace(/\/shrink_[0-9][0-9]_[0-9][0-9]\//, "/");
  }
};

/**
 * Amazon
 */
ThumbnailZoomPlus.Pages.Amazon = {
  key: "amazon",
  name: "Amazon",
  // Work on amazon.com, amazon.cn, https://amazon.co.uk, etc.
  // examples:
  // https://images-eu.ssl-images-amazon.com/images/I/51aYWCfdQkL._SL135_.jpg
  host: /^(.*\.)?((ssl-)?images-)?amazon\.(co\.)?[a-z]+$/,
  
  // Product images seem to come from exc.images-amazon.com.  Static graphics
  // like banners, "Prime" buttons, etc. seem to come from g-exc.images-amazon.com,
  // or have /buttons/ or /gui/ in their URL.
  imageRegExp: /^((?!.*g-ecx\.).*\.)(ssl-)?images\-amazon\.com\/images\/(?!.*(buttons|gui)\/).*/,

  getZoomImage : function(aImageSrc, node, flags) {
    let ex = /\._[a-z0-9].+_\./i;
    if (ex.test(aImageSrc)) {
      return aImageSrc.replace(ex, ".");
    } else {
      return null;
    }
  }
};

/**
 * Hi5
 */
ThumbnailZoomPlus.Pages.Hi5 = {
  key: "hi5",
  name: "Hi5",
  host: /^(.*\.)?hi5\.com$/,
  imageRegExp: /photos|pics|image/,
  getZoomImage : function(aImageSrc, node, flags) {
    let rex1 = new RegExp(/\-01\./);
    let rex2 = new RegExp(/\.small\./);
    let rex3 = new RegExp(".*/hi5image[0-9]+/([0-9]+/.*)-0[1m](" +
                          EXTS+")");
    let image = (rex1.test(aImageSrc) ? aImageSrc.replace(rex1, "-02.") :
                 rex2.test(aImageSrc) ? aImageSrc.replace(rex2, ".") : 
                 rex3.test(aImageSrc) ? aImageSrc.replace(rex3, "http://photos3.hi5.com/$1-02$2") :
                 null);
    return image;
  }
};

/**
 * Picasa
 */
ThumbnailZoomPlus.Pages.Picasa = {
  key: "picasa",
  name: "Picasa",
  host: /picasaweb\.google\.com$/,
  imageRegExp: /lh[0-9]+\.(ggpht|googleusercontent)\.com/,
  getZoomImage : function(aImageSrc, node, flags) {
    let rex = new RegExp(/\/s([0-9]{2}|[123][0-9]{2})(-[a-z])?\//);
    let image = (rex.test(aImageSrc) ? aImageSrc.replace(rex, "/s700/") : null);
    return image;
  }
};

/**
 * MySpace
 */
ThumbnailZoomPlus.Pages.MySpace = {
  key: "myspace",
  name: "MySpace",
  host: /^(.*\.)?myspace\.com$/,
  imageRegExp: /images\.myspacecdn\.com/,
  
  getZoomImage : function(aImageSrc, node, flags) {
    let rex1 = new RegExp(/(\/|\_)[smlt]\./i);
    let rex2 = new RegExp(/\/(sml|med|lrg)_/i);
    let image = (rex1.test(aImageSrc) ? aImageSrc.replace(rex1, "$1l.") :
      (rex2.test(aImageSrc) ? aImageSrc.replace(rex2, "/lrg_") : null));
    return image;
  }
};

/**
 * Netflix
 */
ThumbnailZoomPlus.Pages.Netflix = {
  key: "netflix",
  name: "Netflix",
  host: /^(.*\.)?(netflix\.com|netflix\..*llnwd\.net|instantwatcher\.com)$/,
  imageRegExp: new RegExp("://movies\\.netflix\\.com/WiPlayer\\?movieid=|" +
                          "://movies\\.netflix\\.com/WiMovie/.*/([0-9]+)\\?.*|" +
                          "\\.nflximg\\.com/.*" + EXTS + "$|" +
                          "netflix\\..*llnwd\\.net/.*" + EXTS + "$"),
                          
  getImageNode : function(aNode, nodeName, nodeClass, imageSource) {
    if (nodeName == "a" || nodeName == "img") {
      return aNode;
    }
    return null;
  },

  getZoomImage : function(aImageSrc, node, flags) {
    // We'll set flags.popupAvoiderWidth for thumbs which cause
    // the site itself to display a popup; this allows TZP to avoid
    // positioning our own popup where the site's is likely to be.
    flags.popupAvoiderLREdge = 1;
    flags.popupAvoiderWidth = 0; // no avoider yet...

    // For static thumbs
    // http://cdn-2.nflximg.com/en_us/boxshots/large/60024022.jpg becomes
    // http://cdn-2.nflximg.com/en_us/boxshots/ghd/60024022.jpg
    // when not logged in, sign-up page needs to change 
    // https://netflix.hs.llnwd.net/e1/en_us/boxshots/large/70208522.jpg to
    //     // when not logged in, sign-up page has 
    // https://netflix.hs.llnwd.net/e1/en_us/boxshots/ghd/70208522.jpg
    let netflixRex1 = new RegExp("(/boxshots)/(large|small|tiny|[0-9]+)/");
    if (netflixRex1.test(aImageSrc)) {
      // popup for DVD box w/o play now.
      flags.popupAvoiderWidth = 392;
    }
    
    aImageSrc = aImageSrc.replace(netflixRex1, "$1/ghd/");

    let netflixRex2 = new RegExp("(\.nflximg.com/.*/kidscharacters)/(large|small|main|[0-9]+)/");
    aImageSrc = aImageSrc.replace(netflixRex2, "$1/cdp/");
    
    // For movie thumbs with "play" icons / links
    // Change http://movies.netflix.com/WiPlayer?movieid=70128681&amp;trkid=3651203&amp;nscl=1 to
    // http://cdn-1.nflximg.com/en_us/boxshots/ghd/70128681.jpg
    // and http://movies.netflix.com/WiMovie/Phineas_Ferb/70177007?trkid=4009636
    // to http://cdn-1.nflximg.com/en_us/boxshots/ghd/70177007.jpg
    let netflixRex3 = new RegExp(".*//movies\\.netflix\\.com/WiPlayer\\?movieid=([0-9]+).*");
    let netflixRex4 = new RegExp(".*//movies\\.netflix\\.com/WiMovie/.*/([0-9]+)\\?.*");
    if (netflixRex3.test(aImageSrc) || netflixRex4.test(aImageSrc)) {
      // large popup for "play now"
      flags.popupAvoiderWidth = 384;
    }
    aImageSrc = aImageSrc.replace(netflixRex3, "http://cdn-1.nflximg.com/en_us/boxshots/ghd/$1.jpg");
    aImageSrc = aImageSrc.replace(netflixRex4, "http://cdn-1.nflximg.com/en_us/boxshots/ghd/$1.jpg");
    
    return aImageSrc;
  }
};

/**
 * Flickr
 */
ThumbnailZoomPlus.Pages.Flickr = {
  key: "flickr",
  name: "Flickr",
  host: /^(.*\.)?(static)?flickr\.com$/,
  imageRegExp: /farm[0-9]+\.static\.?flickr\.com|l.yimg.com\/g\/images\/spaceout.gif/,
  
  getImageNode : function(aNode, nodeName, nodeClass, imageSource) {
    
    /*
        spaceball:
        Images in the new Favorites page have a "spaceball" div
        node which overlaps the actual img.  The same happens for photos
        tagged as "The owner has disabled downloading of their photos".
        Find the actual img node to allow it to pop-up, as follows.  
        Ideally we'd like to detect when the photo is disabled for saving by
        the site so we could disable our own save, but I don't see how to tell
        that from the html.
    */
    if (-1 != nodeClass.indexOf("spaceball")) {
      ThumbnailZoomPlus.Pages._logger.debug("Flickr getImageNode: saw spaceball");
      let imgNodes = aNode.parentNode.getElementsByTagName("img");
      if (imgNodes.length > 0) {
        ThumbnailZoomPlus.Pages._logger.debug("Flickr getImageNode: returning " +
        imgNodes[0]);
      }
      return imgNodes[0];
    }
    
    // Not sure if this part still works.  I think it's for hovering
    // over the "i" more info icon.
    if (imageSource && -1 != imageSource.indexOf("spaceout.gif")) {
      ThumbnailZoomPlus.Pages._logger.debug("Flickr getImageNode: saw spaceout.gif");
      return aNode.parentNode.parentNode.firstChild.firstChild;
    }
    
    return aNode;
  },
    
  getZoomImage : function(aImageSrc, node, flags) {
    // match an image name with a s, m, or t size code, or no size code, e.g.
    // http://farm2.staticflickr.com/1120/1054724938_a67ff6eb04_s.jpg or
    // http://farm2.staticflickr.com/1120/1054724938_a67ff6eb04.jpg
    let rex = new RegExp(/(?:_[a-z])?(\.[a-z]+)$/);
    // Substitute to the letter code for the desired size (_z=Medium_640).
    // It's tempting to use a code for a larger size, but some images aren't
    // available in larger size, causing them to get no popup at all if we change
    // it.
    let image = (rex.test(aImageSrc) ? aImageSrc.replace(rex, "_z$1") : null);

    return image;
  }
};

/**
 * Wikipedia
 */
ThumbnailZoomPlus.Pages.Wikipedia = {
  key: "wikipedia",
  name: "Wikipedia",
  host: /.*/,
  
  /*
     Examples:
       http://upload.wikimedia.org/wikipedia/en/thumb/e/ef/Indus_River_Delta.jpg/100px-Indus_River_Delta.jpg becomes
       http://upload.wikimedia.org/wikipedia/en/e/ef/Indus_River_Delta.jpg
       
       http://upload.wikimedia.org/wikipedia/commons/thumb/3/3f/Ernest_Hemingway_Kenya_safari_1954.png/100px-Ernest_Hemingway_Kenya_safari_1954.png becomes
       http://upload.wikimedia.org/wikipedia/commons/3/3f/Ernest_Hemingway_Kenya_safari_1954.png

       http://upload.wikimedia.org/wikipedia/commons/thumb/e/e6/Haute-Vienne-Position.svg/250px-Haute-Vienne-Position.svg.png becomes
       http://upload.wikimedia.org/wikipedia/commons/e/e6/Haute-Vienne-Position.svg   

       double extension:
       http://upload.wikimedia.org/wikipedia/commons/thumb/8/83/Dannebrog.jpg/170px-Dannebrog.jpg.png
       
       also applies to many other mediawiki sites, e.g.
       http://torque-bhp.com/wiki/images/thumb/1/13/Diagnostic.jpg/180px-Diagnostic.jpg becomes
       http://torque-bhp.com/wiki/images/thumb/1/13/Diagnostic.jpg/800px-Diagnostic.jpg or
       http://torque-bhp.com/wiki/images/1/13/Diagnostic.jpg
       or
       http://wiki.the-big-bang-theory.com/images/thumb/2/2d/Kaley-Cuoco.jpg/140px-Kaley-Cuoco.jpg
       Others listed at http://s23.org/wikistats/largest_html.php?sort=users_desc&th=999&lines=999
   */
  imageRegExp: /\/thumb\/([^\/]+\/[^\/]+)\/(.*)\/[0-9]+px-\2(\.(png|jpg|gif))?$/i,
  
  getZoomImage : function(aImageSrc, node, flags) {
    aImageSrc = aImageSrc.replace(/\/thumb\/([^\/]+\/[^\/]+)\/(.*)\/[0-9]+px-\2.*/i,
                                  "/$1/$2");
    let rex3 = new RegExp(/\.svg$/i);
    return aImageSrc;

    // Mediawiki software is used by many sites including wikipedia.  The latter has its
    // own page definition in this file, but perhaps they should be merged?

  }
};

/**
 * DeviantART
 */
ThumbnailZoomPlus.Pages.DeviantART = {
  // Change
  // https://s.deviantart.com/th/fs70/150/i/2011/244/0/2/they__ll_name_a_city_after_us_by_majdear-d48jvmu.jpg to
  // https://s.deviantart.com/th/fs70/i/2011/244/0/2/they__ll_name_a_city_after_us_by_majdear-d48jvmu.jpg
  // and
  // http://th06.deviantart.net/images/150/i/2003/47/c/5/aaa.jpg to
  // http://th06.deviantart.net/images/i/2003/47/c/5/aaa.jpg
  // Also
  // http://th06.deviantart.net/fs70/300W/f/2011/279/a/e/aaa.jpg
  //
  // Note: doesn't currently work for gifs since multiple parts of their URLS change and
  // I don't know how to predict that, e.g.
  //   http://fc06.deviantart.net/fs70/i/2011/331/1/4/charmander_the_stray_by_brittanytucker-d4hijn7.gif to
  //   http://fc04.deviantart.net/fs70/f/2011/331/b/3/charmander_the_stray_by_brittanytucker-d4hijn7.gif
  key: "deviantart",
  name: "deviantART",
  host: /^(.*\.)?deviantart\.com$/,
  imageRegExp: /(th[0-9]+|[as])\.deviantart\.(net|com)\/.*\/\d+[A-Za-z]?(\/[fiop]\/[0-9])/,
  getZoomImage : function(aImageSrc, node, flags) {
    let picRex = new RegExp(/\/\d+[A-Za-z]?(\/[fiop]\/[0-9])/);
    let image = (picRex.test(aImageSrc) ? aImageSrc.replace(picRex, "$1") : 
                 null);
    return image;
  }
};

/**
 * OkCuid
 */
ThumbnailZoomPlus.Pages.OkCupid = {
  // Change http://ak3.okccdn.com/php/load_okc_image.php/images/60x60/60x60/531x24/1092x585/2/4433975072448026333.jpeg
  // to     http://ak3.okccdn.com/php/load_okc_image.php/images/4433975072448026333.jpeg
  key: "okcupid",
  name: "okCupid",
  host: /^.*\.okcupid\.com$/,
  imageRegExp: /^https?:\/\/[^\/]*\.okccdn\.com\/.*\/images\/.*\/[0-9]+\.(jpe?g|png|gif)$/i,
  getZoomImage : function(aImageSrc, node, flags) {
    // http://ak1.okccdn.com/php/load_okc_image.php/images/160x160/160x160/189x210/687x708/2/17985133630795268990.jpeg
    let picRex = new RegExp(/^(.*\.okccdn\.com\/.*\/images\/)[0-9x\/]*\/([0-9]+\.(jpe?g|png|gif))$/);
    let image = (picRex.test(aImageSrc) ? aImageSrc.replace(picRex, "$1$2") : 
                 null);
    return image;
  }
};

/**
 * PhotoBucket
 */
ThumbnailZoomPlus.Pages.PhotoBucket = {
  key: "photobucket",
  name: "PhotoBucket",
  host: /^(.*\.)?photobucket\.com$/,
  imageRegExp: /\.photobucket.com\/(albums|groups)/,
  getZoomImage : function(aImageSrc, node, flags) {
    let rex = new RegExp(/\/th_/);
    let image = (rex.test(aImageSrc) ? aImageSrc.replace(rex, "/") : null);
    return image;
  }
};

/**
 * Pinterest
 */
ThumbnailZoomPlus.Pages.Pinterest = {
  key: "pinterest",
  name: "Pinterest",
  host: /^(.*\.)?pinterest\.com$/,
  
  // eg https://s-media-cache-ec4.pinimg.com/upload/165225880049687299_GEFs3cp0_b.jpg
  //       http://media-cache-ec9.pinterest.com/upload/76983474850615703_fCXJVbYR_f.jpg
  imageRegExp: /.*\/(s-)?media-[^.\/]*\.(pinterest|pinimg)\.com\/(upload|avatars)\/.*/,
  
  getZoomImage : function(aImageSrc, node, flags) {
    // for images:
    // eg seen at http://pinterest.com/pin/98164466848180792/
    // https://pinterest.com/pin/76983474851009277/
    let rex = new RegExp("([0-9_a-zA-Z]+_)[tb](" + 
                         EXTS + ")");
    aImageSrc = aImageSrc.replace(rex, "$1f$2");

    // for avatars:
    // http://media-cdn.pinterest.com/avatars/ohjoy-18.jpg becomes
    // http://media-cdn.pinterest.com/avatars/ohjoy-18_o.jpg
    rex = new RegExp("(/avatars/.*)(\\.jpg)$")
    aImageSrc = aImageSrc.replace(rex, "$1_o$2");
    
    return aImageSrc;
  }
};

/**
 * Tagged
 */
ThumbnailZoomPlus.Pages.Tagged = {
  key: "tagged",
  name: "Tagged",
  host: /^(.*\.)?tagged\.com$/,
  imageRegExp: /[a-z]+[0-9]+\.tagstat.com\/image/,
  getZoomImage : function(aImageSrc, node, flags) {
    let rex = new RegExp(/\/[123456789]0([\w-]+\.[a-z]+)/);
    let image = (rex.test(aImageSrc) ? aImageSrc.replace(rex, "/00$1") : null);
    return image;
  }
};

/**
 * Last.fm
 */
ThumbnailZoomPlus.Pages.LastFM = {
  key: "lastfm",
  name: "Last.fm",
  host: /^(.*\.)?(last\.fm|lastfm.[a-z]+)$/,
  imageRegExp: /userserve-ak\.last\.fm\/serve/,
  getImageNode : function(aNode, aNodeName, aNodeClass, imageSource) {
    let image = aNode;
    if ("span" == aNodeName  && aNode.previousSibling) {
      if ("overlay" == aNodeClass) {
        image = aNode.previousSibling.firstChild;
      } else if ("jewelcase" == aNodeClass) {
        image = aNode.previousSibling;
      }
    }
    return image;
  },
  
  getZoomImage : function(aImageSrc, node, flags) {
    let rex = new RegExp(/\/serve\/\w+\//);
    let image =
      (rex.test(aImageSrc) ? aImageSrc.replace(rex, "/serve/_/") : null);
    return image;
  }
};

/**
 * Google+ (Google Plus)
 */
ThumbnailZoomPlus.Pages.GooglePlus = {
  key: "googleplus",
  name: "Google+",
  host: /^(.*\.)?plus\.google\.com$/,

  // Note: the sz=48 or 32 or 24 case is the tiny thumb for which Google already has a popup which
  // shows a medium thumb and Add To Circles; we don't want our popup from that tiny one.
  // Also exclude */s-24c/photo.jpg, the profile menu button.
  imageRegExp: /\.(ggpht|googleusercontent)\.com\/(?!.*photo\.jpg\?sz=(24|32|48))(?!.*\/s24-c\/photo\.jpg).*/,
  
  _logger: ThumbnailZoomPlus.Pages._logger,
  
  getZoomImage : function(aImageSrc, node, flags) {

    // example profile pic link: https://lh3.googleusercontent.com/-TouICNeczXY/AAAAAAAAAAI/AAAAAAAAAf8/eS42KCD74YM/photo.jpg?sz=80
    // example image link: https://lh3.googleusercontent.com/-TouICNeczXY/AAAAAAAAAAI/AAAAAAAAAf8/eS42KCD74YM/photo.jpg

    let rex3 = new RegExp(/\/photo\.jpg\?sz=([0-9]+)$/);
    if (rex3.test(aImageSrc)) {
      this._logger.debug("matched google+ profile pic");
      return aImageSrc.replace(rex3, "/photo.jpg");
    }
    
    // example photo thumb: https://lh6.googleusercontent.com/-sHGfoG3xxXX/TnlXXz7dHmI/AAXXAAAAAI8/upXXI3JTguI/w402/065.JPG
    // corresponding large image: https://lh6.googleusercontent.com/-sHGfoG3xxXX/TnlXXz7dHmI/AAXXAAAAAI8/upXXI3JTguI/065.JPG
    // the w402 field supports arbitrary width, height, and size specifications with
    // w###, h###, s###.  I've also seen a "-k" suffix.
    //
    let rex1 = new RegExp(/\/(([swh][0-9]+|-[a-z])-?)+\//);
    if (rex1.test(aImageSrc)) {
      this._logger.debug("matched google+ non-profile photo");
      return aImageSrc.replace(rex1, "/");
    }

    // example shared link thumb: https://images2-focus-opensocial.googleusercontent.com/gadgets/proxy?url=http://www.avantmusicnews.com/wp-content/themes/weaver/images/headers/sunset.jpg&container=focus&gadget=a&rewriteMime=image/*&refresh=31536000&resize_h=120&no_expand=1
    // corresponding image: http://www.avantmusicnews.com/wp-content/themes/weaver/images/headers/sunset.jpg
    let rex2 = /.*gadgets\/proxy\?url=([^&]+).*/;
    if (rex2.test(aImageSrc)) {
      // Extract the image's URL, which also needs to be url-unescaped.
      this._logger.debug("matched google+ shared URL");
      aImageSrc = aImageSrc.replace(rex2, "$1");
      aImageSrc = unescape(aImageSrc);
      return aImageSrc;
    }
    
    this._logger.debug("did not match any google+ URL");
    return null;
  }
};

/**
 * Gmail
 */
ThumbnailZoomPlus.Pages.GMail = {
  key: "gmail",
  name: "GMail",
  host: /^(.*\.)?mail\.google\.com$/,
  imageRegExp: /\/mail.google.com\/mail\/.*&view=att.*&disp=thd/,
  
  getZoomImage : function(aImageSrc, node, flags) {
    // change:
    // https://mail.google.com/mail/u/0/?ui=2&ik=4ed1eeeaae&view=att&th=133f51e77a267265&attid=0.1&disp=thd&realattid=f_gvmhze0k1&zw to
    // https://mail.google.com/mail/u/0/?ui=2&ik=4ed1eeeaae&view=att&th=133f51e77a267265&attid=0.1&disp=inline&realattid=f_gvmhze0k1&zw
    let rex1 = new RegExp(/(.*)&disp=thd(.*)/);
    if (rex1.test(aImageSrc)) {
      return aImageSrc.replace(rex1, "$1&disp=inline$2");
    }
    return null;
  }
};

/**
 * Google (Google Images)
 */
ThumbnailZoomPlus.Pages.Google = {
  key: "google",
  name: "", // Set in ENTITYgoogle.
  
  // host is all of Google so it can work on images.google.com, 
  // www.google.com general search with image results, etc.
  // To prevent this from interfering with GooglePlus, its entry
  // comes later in filterService.js.
  host: /^((?!picasaweb).*\.google(\.com)?\.[a-z]+)$/,  
  imageRegExp: /^https?:\/\//,
  
  getImageNode : function(node, nodeName, nodeClass, imageSource) {
    return node.parentNode;
  },

  getZoomImage : function(aImageSrc, node, flags) {
    let imgurlEx = new RegExp(/.*[\?&]img_?url=([^&]+).*$/);
    if (imgurlEx.test(aImageSrc)) {
      aImageSrc = aImageSrc.replace(imgurlEx, "$1");
      aImageSrc = decodeURIComponent(aImageSrc);
      aImageSrc = decodeURIComponent(aImageSrc);
      if (! /^https?:\/\/./.test(aImageSrc)) {
        aImageSrc = "http://" + aImageSrc;
      }
    } else {
      aImageSrc = null;
    }
    return aImageSrc;
  }
};

/**
 * YouTube
 */
ThumbnailZoomPlus.Pages.YouTube = {
  key: "youtube",
  name: "YouTube",
  host: /^(.*\.)?(nsfw)?youtube\.com|i[0-9]*\.ytimg\.com$/,
  imageRegExp: /i[0-9]*\.ytimg\.com\/vi\//,
  
  getZoomImage : function(aImageSrc, node, flags) {
    let rex = new RegExp(/\/default\./);
    let image =
      (rex.test(aImageSrc) ? aImageSrc.replace(rex, "/hqdefault.") : null);
    return image;
  }
};

/**
 * Daily Mile
 */
ThumbnailZoomPlus.Pages.DailyMile = {
  key: "dailymile",
  name: "Daily Mile",
  host: /^(.*\.)?dailymile\.com$/,
  imageRegExp: /(dmimg|dailymile)\.com\/(images|pictures|photos)\//,
  getZoomImage : function(aImageSrc, node, flags) {
    let rex = new RegExp(/_(mini|profile|preview|avatar)\./);
    let image = (rex.test(aImageSrc) ? aImageSrc.replace(rex, ".") : aImageSrc);
    return image;
  }
};

/**
 * IMDb
 */
ThumbnailZoomPlus.Pages.IMDb = {
  key: "imdb",
  name: "IMDb",
  host: /^(.*\.)?imdb\.[a-z]+$/,
  imageRegExp: /ia\.media\-imdb\.com\/images\//,
  getZoomImage : function(aImageSrc, node, flags) {
    let rex = new RegExp(/\._.+_(\.[a-z]+)/i);
    let image = (rex.test(aImageSrc) ? aImageSrc.replace(rex, "$1") : null);
    return image;
  }
};

/**
 * Imgur
 */
ThumbnailZoomPlus.Pages.Imgur = {
  key: "imgur",
  name: "Imgur",
  host: /^(.*\.)?imgur\.com$/,
  imageRegExp: /(i\.)?imgur\.com\//,
  getZoomImage : function(aImageSrc, node, flags) {
    let rex = new RegExp(/(\/[a-z0-9]{5})[bsm](\.[a-z]+)/i);
    let image = (rex.test(aImageSrc) ? aImageSrc.replace(rex, "$1$2") : null);
    return image;
  }
};

/**
 * Photosight.ru and Photosight.com
 *
 * ex1:
 * http://s.photosight.ru/img/4/aef/4167500_icon.jpg
 * http://s.photosight.ru/img/4/aef/4167500_large.jpg
 * ex2:
 * http://img-1.photosight.ru/e68/4167692_top_of_day.jpg
 * http://img-1.photosight.ru/e68/4167692_large.jpg
 * ex3:
 * http://s.photosight.ru/img/5/7bd/4167881_crop_1.jpeg
 * http://s.photosight.ru/img/5/7bd/4167881_large.jpeg
 *
 * ex4 (for very old images):
 * http://prv-2001-04.photosight.ru/03/pv_26.jpg
 * http://img-2001-04.photosight.ru/03/26.jpg
 *
 * http://www.photosight.com/prv/2012/05/09/pv_1612453.jpg becomes
 * http://images.photosight.com/2012/05/09/1612453.jpg
 */
ThumbnailZoomPlus.Pages.Photosight = {
  key: "photosight",
  name: "Photosight",
  host: /^(.*\.)?photosight\.(ru|com)$/i,
  imageRegExp: /\.photosight\.(ru|com)/i,
  
  getZoomImage : function(aImageSrc, node, flags) {
    let rex1 = new RegExp(/_(icon)\./);
    let rex2 = new RegExp(/_(crop)_[0-9]+\./);
    let rex3 = new RegExp(/_top_of_day\./);
    let rex4 = new RegExp("//prv-(.*/)pv_([0-9]+\\.)");
    let rex5 = new RegExp("//www.photosight.com/prv/(.*/)pv_([0-9]+\\.)");
    let image = 
      rex1.test(aImageSrc) ? aImageSrc.replace(rex1, "_large.") :
      rex2.test(aImageSrc) ? aImageSrc.replace(rex2, "_large.") :
      rex3.test(aImageSrc) ? aImageSrc.replace(rex3, "_large.") : 
      rex4.test(aImageSrc) ? aImageSrc.replace(rex4, "//img-$1$2") :
      rex5.test(aImageSrc) ? aImageSrc.replace(rex5, "//images.photosight.com/$1$2") :
      null;
    
    return image;
  }
};

/**
 * Fotop.net
 */
ThumbnailZoomPlus.Pages.Fotop = {
  key: "fotop",
  name: "Fotop.net",
  host: /^(.*\.)?fotop\.net$/i,
  imageRegExp: /\.fotop\.net/i,
  
  getZoomImage : function(aImageSrc, node, flags) {
    // change *.thumb.jpg to *.jpg
    let image = aImageSrc.replace(/\.thumb(\.[a-z]+)$/, "$1");
    
    // http://temp3.fotop.net/albums2/cathysin/.pj/tnMFNFs0t.jpg becomes
    // http://temp3.fotop.net/albums2/cathysin/.pj/tnMFNFs0.jpg
    image = image.replace(/(\/.pj\/[^.\/]+)t\./, "$1.");
    
    // change http://temp3.fotop.net/albums7/NoirSaya/.a/t4bc5f5bd9883a.jpg
    // to http://temp3.fotop.net/albums7/NoirSaya/.a/4bc5f5bd9883a.jpg
    image = image.replace(/\/\.a\/t([^.\/]*\.)/, "/.a/$1");
    
    return image;
  }
};

/**
 * Engadget
 */
ThumbnailZoomPlus.Pages.Engadget = {
  key: "engadget",
  name: "Engadget",
  host: /^(.*\.)?engadget\.[a-z]+$/,
  imageRegExp: /_[0-9]+x[0-9]+\.[a-zA-Z]+$/,
  getZoomImage : function(aImageSrc, node, flags) {
    let rex = new RegExp(/_[0-9]+x[0-9]+(\.[a-zA-Z]+)$/i);
    let image = (rex.test(aImageSrc) ? aImageSrc.replace(rex, "$1") : null);
    return image;
  }
};

/**
 * Others: this is for arbitrary sites which link directly to image files
 * and other situations for which we can determine an image linked from
 * an arbitrary site.
 */
ThumbnailZoomPlus.Pages.Others = {
  key: "others",
  name: "", // Set in ENTITYothers.
  host: /.*/,
  preferLinkOverThumb: true,
  
  // imgur.com links w/o image type suffix give page containing image.
  // Allow that; we'll add suffix in getZoomImage.  Also allow youtube links,
  // which getZoomImage will convert to a youtube thumb.
  // Note that we can't support imgur.com/a/ links (albums) since there is no
  // image named similarly to the link.
  
  imageRegExp: new RegExp(
      EXTS + "([?&].*)?$"
    + "|tumblr.com/(photo/|tumblr_)"
    + "|imgur\\.com/(gallery/)?(?!gallery|tools|signin|register|tos$|contact|removalrequest|faq$)[^/&\\?]+(&.*)?$"
    + "|(?:www\\.(nsfw)?youtube\\.com|youtu.be)/(watch|embed)"
    + "|/youtu.be/[^/]+$"
    + "|quickmeme\\.com/meme/"
    + "|qkme.me/"
    + "|^https?://memegenerator.net/instance/"
    + "|/index.php\?.*module=attach" // IP.board, eg rootzwiki.com
    + "|^(https?://(.*\\.)?twitpic.com/)(?!(upload))([a-z0-9A-Z]+)$"
    + "|^https?://twitter.com/.*\\?url=(http[^&]+)(&.*)?$"
    + "|^https?://([^/?&]*\.)?fotoblur\.com/images/[0-9+]"
    + "|[\?&]img_?url="
    + "|(https?)://(?!(?:www|today|groups|muro|chat|forum|critiques|portfolio|help|browse)\\.)([^/?&.])([^/?&.])([^/?&.]*)\\.deviantart\\.com/?$"
    + "|stumbleupon.com\/(to|su)\/[^\/]+\/(.*" + EXTS + ")"
    + "|^https?:\/\/([^/]*\.)?viddy\.com\/(play/)?video\/[^\/?]+"
    // end
    , "i"),
                          
  _logger: ThumbnailZoomPlus.Pages._logger,
  
  // For "Others"
  getImageNode : function(aNode, nodeName, nodeClass, imageSource) {
    let imgNode = null;
    let imgNodeURL = null;
    if (aNode.localName.toLowerCase() == "img") {
      imgNode = aNode;
      imgNodeURL = aNode.getAttribute("src");
    }

    // try to find an enclosing <a> (link) tag.
    while (aNode != null) {
      let name = aNode.localName;
      if (name == null) {
        aNode = null;
        break;
      }
      name = name.toLowerCase();
      if (name == "frame" || name == "iframe" || name == "body") {
        // failed to find anything.
        aNode = null;
        break;
      }
      if (aNode.localName.toLowerCase() == "a") {
        // found enclosing link.
        break;
      }
      this._logger.debug("ThumbnailPreview: Others: trying parent of " + aNode.localName);
      aNode = aNode.parentNode;
    }
    this._logger.debug("ThumbnailPreview: Others: found node " + aNode);

    // For tumblr.com:
    let tumblrRegExp = new RegExp("\\.tumblr\\.com/(photo/|tumblr_)", "i");
    if (tumblrRegExp.test(imgNodeURL)) {
      // Tumblr dashboard when Full Images is off doesn't link to the full-size
      // images.  The img node has id="thumbnail_photo_1234567890", and
      // the <a> node linking to the high-res image has id="high_res_link_1234567890"
      let id=imgNode.id;
      id = id.replace("thumbnail_photo_", "high_res_link_");
      let related = imgNode.ownerDocument.getElementById(id);
      this._logger.debug("Others: related ID=" + id + "; related=" +
                         String(related));
      if (related && related.getAttribute("href") != "") {
          imgNodeURL = related.getAttribute("href");
          aNode = related;
          this._logger.debug("Others: detected tumblr high-rez link " +
                             String(aNode));
      }
      
      // Special hack for tumblr: tumblr often uses thumbs which have links, where
      // the thumb itself could be shown larger and the link may point to
      // a non-image such as another tumblr's blog.  So we'd rather use the 
      // thumb's image itself as our node than its link.  This is especially
      // useful when the images are larger than the embedded size, e.g. when
      // viewing tumblr zoomed out.
      //
      // TODO: The more general way to handle this would be to return both the
      // link's node and the image's node, but the framework doesn't currently
      // let us return multiple.  The general approach would let us remove the
      // tumblr-specific code and work better on all sites.
      let tumblrOrPhotoRegExp = 
        new RegExp("\\.tumblr\\.com/(photo/|tumblr_).*" +
                   "|(.*" + EXTS + ")" +
                   "|fotoblur\.com/images/[0-9]+", "i");
      if (// We disallow assets.tumblr.com, e.g. the "dashboard" button.
          ! /assets\.tumblr\.com/.test(imgNodeURL) &&
          // test the link node's URL to see if it's an image:
          (aNode == null || ! tumblrOrPhotoRegExp.test(String(aNode))) ) {
        this._logger.debug("Others: detected tumblr; using thumb as image, node "
                           + imgNode + " " + imgNodeURL);
        
        return imgNode;
      }
    }
    
    return aNode;
  },
  
  // For "Others"
  getZoomImage : function(aImageSrc, node, flags) {
    /*
       The rules here transform various kinds of link URLs into links to images.
       The simplest case is a link which already refers directly to a *.jgp or
       other image.
       
       Cases which are tested first is cases which transform a URL into a
       different URL, which may be the URL of an image or a URL which can
       be processed by the rules after it to produce an image.  An 
       example is a stumbleupon link or deviantart link which refers to
       a YouTube video.  The stumbleupon rule turns it into a youtube URL,
       and then the youtube rule turns it into a jpg.
     */
    
    if (/^https?:\/\/[^\/]*\.wikipedia.org\/wiki\/File:/i.test(aImageSrc)) {
      // wikipedia page URLs look like image URLs but they aren't.  We don't
      // support showing images for wiki page links, but the Wikipedia rule does
      // support wikipedia *thumbnails*.
      return null;
    }
    
    if (/^https?:\/\/photo\.xuite\.net\/./.test(aImageSrc)) {
      // Prohibit using links from photo.xuite.net since they look like
      // .jpg URLs but are really html.  By rejecting them here we let the
      // Thumbnails rule handle them.
      return null;
    }
        
    // For StumbleUpon.com links, change
    // http://www.stumbleupon.com/to/3roKbh/content.mindcrap.com/gallery/dogs/15/34.jpg/t:7ed1a2cbdd70f;src:all or
    // http://www.stumbleupon.com/su/3roKbh/content.mindcrap.com/gallery/dogs/15/34.jpg to
    // http://content.mindcrap.com/gallery/dogs/15/34.jpg
    let stumbleUponEx = new RegExp(/^(.*\.)?stumbleupon.com\/(to|su)\/[^\/]+\/(.*?)(\/t:[0-9a-f]+;.*)?$/);
    if (stumbleUponEx.test(aImageSrc)) {
      aImageSrc = aImageSrc.replace(stumbleUponEx, "http://$3");
      aImageSrc = decodeURIComponent(aImageSrc);
      aImageSrc = decodeURIComponent(aImageSrc);
    }

    // For google images links, google video search, images.yandex.ru, 
    // and some others, get URL from imgurl=... part.
    let imgurlEx = new RegExp(/.*[\?&](img_?)?url=([^&]+).*$/);
    if (imgurlEx.test(aImageSrc)) {
      aImageSrc = aImageSrc.replace(imgurlEx, "$2");
      aImageSrc = decodeURIComponent(aImageSrc);
      if (! /^https?:\/\/./.test(aImageSrc)) {
        aImageSrc = "http://" + aImageSrc;
      }
    }

    // https://www.facebook.com/l.php?u=http%3A%2F%2Fi.imgur.com%2FmLR3d.jpg
    let rexFBExternal = /.*\.facebook\.com\/l\.php\?(?:.*&)?u=([^&]+).*/;
    if (rexFBExternal.test(aImageSrc)) {
      aImageSrc = aImageSrc.replace(rexFBExternal, "$1");
      aImageSrc = decodeURIComponent(aImageSrc);
    }

    // Deviantart external links: change
    // http://www.deviantart.com/users/outgoing?http://www.youtube.com/watch?v=DLQBAOomHzq to
    // http://www.youtube.com/watch?v=DLQBAOomHzq
    let deviantOutgoingRex = new RegExp("https?://[^\\.]+\\.deviantart\\.com/.*/outgoing\\?(.*)");
    aImageSrc = aImageSrc.replace(deviantOutgoingRex, "$1");

    // Deviantart profile links:
    // Change link
    // http://truong-abcdef.deviantart.com/ to
    // http://a.deviantart.net/avatars/t/r/truong-san.jpg?1 (/t/r/ are from the 1st 2 letters)
    // We unfortunately have to assume either jpg or gif.
    let deviantProfileRex = new RegExp("(https?)://([^/?&.])([^/?&.])([^/?&.]*)\\.deviantart\\.com/?$");
    aImageSrc = aImageSrc.replace(deviantProfileRex, "$1://a.deviantart.net/avatars/$2/$3/$2$3$4.jpg?1");
    
    // For twitter links like https://twitter.com/#!/search/picture/slideshow/photos?url=https%3A%2F%2Fp.twimg.com%2FAe0VPNGCIAIbRXW.jpg
    let twitterEx = new RegExp("^https?://twitter.com/.*\\?url=([^&]+)(&.*)?$");
    aImageSrc = decodeURIComponent(aImageSrc.replace(twitterEx, "$1"));
    
    // For links to twitpic pages, chage
    // http://twitpic.com/10l4j4.jpg to
    // http://twitpic.com/show/full/10l4j4  (or .../large/...)
    let twitpicEx = new RegExp("^(https?://(.*\\.)?twitpic.com/)([^\\./]+)$");
    aImageSrc = aImageSrc.replace(twitpicEx, "$1/show/full/$3");
    
    // For google.com/url?v= for youtube.com:
    // http://www.google.com/url?q=http://www.youtube.com/watch%3Fv%3Dr6-SJLlneLc&sa=X&ei=JMh-T__sEcSviAKIrLSvAw&ved=0CCEQuAIwAA&usg=AFQjCNEl2fsaLGeItGZDrJ0U_IEPghjL0w to
    // http://www.google.com/url?q=http://www.youtube.com/watch%3Fv%3Dr6-SJLlneLc&sa=X&ei=JMh-T__sEcSviAKIrLSvAw&ved=0CCEQuAIwAA&usg=AFQjCNEl2fsaLGeItGZDrJ0U_IEPghjL0w
    let youtube2Ex = new RegExp("^(?:https?://)(?:[^/]*\\.)?google\\.com/url(?:\\?.*)?[?&]q=([^&]*).*$");
    aImageSrc = decodeURIComponent(aImageSrc.replace(youtube2Ex, "$1"));

    // For youtube links, change 
    // http://www.youtube.com/watch?v=-b69G6kVzTc&hd=1&t=30s to 
    // http://i3.ytimg.com/vi/-b69G6kVzTc/hqdefault.jpg
    // http://youtu.be/kuX2lI84YRQ to
    // http://i3.ytimg.com/vi/kuX2lI84YRQ/hqdefault.jpg
    // http://www.youtube.com/embed/87xNpOYOlQ4?rel=0 to
    // http://i3.ytimg.com/vi/87xNpOYOlQ4/hqdefault.jpg
    let youtubeEx = new RegExp("(https?://)(?:[^/]*\\.)?(?:youtube\\.com|nsfwyoutube\\.com|youtu\\.be).*(?:v=|/)([^?&#!/]+)[^/]*/*$");
    aImageSrc = aImageSrc.replace(youtubeEx, "$1i3.ytimg.com/vi/$2/hqdefault.jpg");

    // For blogger aka Blogspot, change
    // http://3.bp.blogspot.com/-3LhFo9B3BFM/T0bAyeF5pFI/AAAAAAAAKMs/pNLJqyZogfw/s500/DSC_0043.JPG to
    // http://3.bp.blogspot.com/-3LhFo9B3BFM/T0bAyeF5pFI/AAAAAAAAKMs/pNLJqyZogfw/s1600/DSC_0043.JPG; change
    // http://1.bp.blogspot.com/-cCrMafs3SJ4/TwcFrqD23II/AAAAAAAABCg/3GxEgPh0qRQ/s320-p/Tiara+Riley.jpeg to
    // http://1.bp.blogspot.com/-cCrMafs3SJ4/TwcFrqD23II/AAAAAAAABCg/3GxEgPh0qRQ/s1600-p/Tiara+Riley.jpeg
    // NOTE: This rule exists in both Others and Thumbnails, and should be the same in both.
    let blogspotRegExp = new RegExp("(\\.(blogspot|blogger)\\.com/.*)/s[0-9]+(-[a-z])?/([^/?&]+\.[^./?&]*)$");
    aImageSrc = aImageSrc.replace(blogspotRegExp, "$1/s1600/$4");

    // memegenerator.net:
    // http://memegenerator.net/instance/21284704?.. becomes
    // http://cdn.memegenerator.net/instances/600x/21284704.jpg
    aImageSrc = aImageSrc.replace(/^(https?:\/\/)memegenerator\.net\/instance\/([0-9]+)([?\/].*)?$/i,
                                  "$1cdn.memegenerator.net/instances/600x/$2.jpg");

    // If imgur link, remove part after "&" or "#", e.g. for https://imgur.com/nugJJ&yQU0G
    // Also turn http://imgur.com/gallery/24Av1.jpg into http://imgur.com/24Av1.jpg
    let imgurRex = new RegExp(/(imgur\.com\/)(gallery\/)?([^\/&#]+)([&#].*)?/);
    aImageSrc = aImageSrc.replace(imgurRex, "$1$3");

    let quickmemeEx = new RegExp(/(?:www\.quickmeme\.com\/meme|(?:i\.)?qkme\.me)\/([^\/\?]+).*/);
    aImageSrc = aImageSrc.replace(quickmemeEx, "i.qkme.me/$1");
  
    // fotoblur.com: change
    // http://www.fotoblur.com/images/389235 to
    // http://www.fotoblur.com/api/resize?id=389235&width=1280&height=1024
    aImageSrc = aImageSrc.replace(/^(https?:\/\/[^\/?]*fotoblur\.com)\/images\/([0-9]+).*/,
                                  "$1/api/resize?id=$2&width=1280&height=1024");
    
    // viddy.com (see also in Thumbnail rule)
    // http://www.viddy.com/video/a35a8581-7c0f-4fd4-b98f-74c6cf0b5794 becomes
    // http://cdn.viddy.com/images/video/a35a8581-7c0f-4fd4-b98f-74c6cf0b5794.jpg
    aImageSrc = aImageSrc.replace(/^(https?:\/\/)(?:[^\/]+\.)?viddy\.com\/(?:play\/)?video\/([^\/?]+).*/i,
                                  "$1/cdn.viddy.com/images/video/$2.jpg");
    // http://viddy.com/play/video/1c042fbd-66d5-4c19-9896-816a0347d2aa?source=Profile becomes
    // http://cdn.viddy.com/images/video/1c042fbd-66d5-4c19-9896-816a0347d2aa?source=Profile
    
    // imgchili.com:
    // http://imgchili.com/show/7428/9998984_ie_011.jpg becomes
    // http://i2.imgchili.com/7428/9998984_ie_011.jpg
    aImageSrc = aImageSrc.replace(/\/\/imgchili\.com\/show\//, "i2.imgchili.com/");
    
    aImageSrc = aImageSrc.replace(/(\/\/img..g\.com)\/\?v=/i, "$1/images/");
    
    // For most sites, if there is no image suffix, add .jpg.
    let rex = new RegExp("tumblr\\.com/.*" + 
                         "|twimg[.0-9-]" +
                         "|twitpic\\.com" +
                         "|(" + EXTS + "([?&].*)?$)"
                         , "i");
    if (! rex.test(aImageSrc)) {
      // add .jpg, e.g. for imgur links, if it doesn't appear anywhere 
      // (including stuff.jpg?more=...)
      aImageSrc += ".jpg";
    }
    this._logger.debug("Others getZoomImage: using zoom image " + aImageSrc);

    return aImageSrc;
  }
};

/**
 * Thumbnail: returns the thumbnail itself as the image source.
 */
ThumbnailZoomPlus.Pages.Thumbnail = {
  key: "thumbnail",
  name: "", // Set in ENTITYthumbnail.
  host: /.*/,
  
  // We basically match any image, but exclude some which are annoying to
  // show.   
  // Expression Tips:
  // Patterns in () must match starting from first slash (or earlier)
  // up to end of entire URL, so typically start with // and end with .* .
  imageRegExp: new RegExp("^(?![^/]*("
                          + "(//.*\\.google\\.com?[.a-z]*/(.*/)?(images|logos)/)" // google logos
                          + "|(//[a-z0-9]+\\.google\\.com?[.a-z]*/.*[/?&]lyrs=.*)" // google maps tiles
                          + "|(//maps\\.google\\.com?[.a-z]*/.*)" // google maps user photo popups, etc.
                          + "|(//maps\\.gstatic\\.com?[.a-z]*/.*)" // google maps button images
                          + "|(//sh\\.deviantart\\.net/shadow/)" // deviantart frame around thumbs
                          + "|(//st\\.deviantart\\.net/.*)" // deviantart logo
                          + "|((.*\.)(ssl-)?images\-amazon\\.com/images/.*/(buttons|gui)/)" // amazon buttons
                          + "|(//[^/]*tiles\\.virtualearth\\.net/.*)" // bing.com/maps tiles
                          + "|(//[^/]*.maps.live.com/i/.*)" // bing.com/maps directions pin
                          + "|^https?://my\\.xmarks\\.com/" // my.xmarks.com
                          + "|.*\\$live\\.controls\\.images/" // microsoft outlook.com
                          + "|.*\\.hotmail.com/cal/" // microsoft hotmail/live calendar
                          + "|.*-(word|excel|powerpoint|onenote).*\.msecnd\.net/./" // microsoft office on skydrive
                          + "|editImageHandler\.ashx" // microsoft powerpoint slide thumbs
                          + ")).*", "i"),
  
  // For "Thumbnail"
  getImageNode : function(node, nodeName, nodeClass, imageSource) {
    if (/gii_folder_link/.test(nodeClass) ||
        (/psprite/.test(nodeClass) && nodeName == "div") || // for dailymotion.com
        (nodeName == "div" && /^(overlay|inner|date|notes)$/.test(nodeClass))) {
      // minus.com single-user gallery or
      // tumblr archive with text overlays like http://funnywildlife.tumblr.com/archive
      // img nodes are in <img> child of the (great(grand))parent node of the
      // hovered-over <a> node.  Find that node.  We don't specificaly test for
      // the tumblr domain since we want to work even when a different domain
      // is used, eg http://www.valentinovamp.com/archive
      // TODO: a generalization of this logic might be useful in general, e.g.
      // for yahoo.co.jp
      let generationsUp = 1; // overlay
      if (/gii_folder_link|inner/.test(nodeClass)) {
        generationsUp = 2;
      } else if (/date|notes/.test(nodeClass)) {
        generationsUp = 3;
      }
      ThumbnailZoomPlus.Pages._logger.debug("thumbnail getImageNode: detected possible minus.com, tumblr.com, or dailymotion.com; going up "
          + generationsUp + " levels and then finding img.");
      let ancestor = node;
      while (generationsUp > 0 && ancestor) {
        ancestor = ancestor.parentNode;
        generationsUp--;
      }
      if (ancestor) {
        // Find child "img" nodes
        let imgNodes = ancestor.getElementsByTagName("img");
        if (imgNodes.length > 0) {
          // Confirm that it's tumblr or minus.com.
          var ancestorClass = ancestor.className;
          if (/gii_folder_link/.test(nodeClass) ||
              /preview_link/.test(ancestorClass) ||  // dailymotion
              /photo/.test(ancestorClass) ) {
            // take the last child.
            node = imgNodes[imgNodes.length-1];
          } else {
            ThumbnailZoomPlus.Pages._logger.debug("thumbnail getImageNode: unconfirmed.");
          }
        }
      }
      ThumbnailZoomPlus.Pages._logger.debug("thumbnail getImageNode: minus.com or tumblr.com archive got " + node);
    }
    
    if (nodeName == "img" && /\/blank\.gif$/.test(imageSource)) {
      // meetup.com sometimes has image in background-image of <a> in
      // <a><img src=".../blank.gif"></a>.
      node = node.parentNode;
    }
    
    return node;
  },
  
  // For "Thumbnail"
  getZoomImage : function(aImageSrc, node, flags) {
    let verbose = false;
    var before;
    
    let nodeName = node.localName.toLowerCase();
    let nodeClass = node.getAttribute("class");
    ThumbnailZoomPlus.Pages._logger.debug("getZoomImage Thumbnail for " + nodeName 
                                          + " class='" + nodeClass + "'" +
                                          " baseURI=" + node.baseURI);

    if (! node.hasAttribute("src") && node.hasAttribute("href") &&
        node.style.backgroundImage.indexOf("url") == -1) {
      // We don't want to use node if it's just an href since we need
      // it to be an actual image.  (The Others rule already handles hrefs.)
      ThumbnailZoomPlus.Pages._logger.debug(
            "thumbnail getZoomImage: ignoring since it's a link, not a thumb");
      return null;
    }
    if (verbose) ThumbnailZoomPlus.Pages._logger.debug(
            "thumbnail getZoomImage p03: so far have " + aImageSrc);

    // For certain sites, if node has a background style, use image from that.
    // And actually, aImageSrc may be already coming from the
    // background but needs to be excluded.
    // But in general we don't since it leads to too many popups from static
    // background styling (non-image) graphics.
    let backImage = node.style.backgroundImage;
    let urlRegExp = /url\("(.*)"\)$/i;
    if (backImage && "" != backImage && urlRegExp.test(backImage)) {
      if (node.children.length > 0 && ! /thumb|mem-photo-small/.test(nodeClass)) {
        // Ignore e.g. in Google Offers, where a big map image is the background
        // around the guts of the page.
        // But we explicitly allow using background image if nodeClass
        // contains "thumb", as on ??? or "mem-photo-small" as on meetup.com
        ThumbnailZoomPlus.Pages._logger.debug(
            "thumbnail getZoomImage: ignoring background image since has " +
            node.children.length + " children > 0");
        return null;
      }
      aImageSrc = backImage.replace(urlRegExp, "$1");
    }
    
    // For diasp.org & similar, get from <img data-full-photo="http://...">
    let fullPhoto = node.getAttribute("data-full-photo");
    if (fullPhoto) {
      aImageSrc = fullPhoto;
    }
    
    aImageSrc = ThumbnailZoomPlus.FilterService.applyBaseURI(node.ownerDocument, aImageSrc);
    if (verbose) ThumbnailZoomPlus.Pages._logger.debug(
            "thumbnail getZoomImage p06: so far have " + aImageSrc);

    // Disable for certain kinds of Facebook thumbs.
    ThumbnailZoomPlus.Pages._logger.debug("thumbnail getZoomImage: node=" +
                                          node + "; class=" +
                                          nodeClass);
    if ("spotlight" == nodeClass && /\.(fbcdn|akamaihd)\.net/.test(aImageSrc) // facebook 'lightbox'
        ) {
        ThumbnailZoomPlus.Pages._logger.debug("getZoomImage: ignoring since Facebook spotlight");
      return null;
    }
    if (nodeClass && nodeClass.indexOf("actorPic") >= 0) {
      // Don't show popup for small Facebook thumb of the person who's
      // entering a comment since the comment field loses focus and the 
      // thumbnails disappears, which is confusing.
        ThumbnailZoomPlus.Pages._logger.debug("getZoomImage: ignoring since Facebook actorPic");
      return null;
    }
    if (verbose) ThumbnailZoomPlus.Pages._logger.debug(
            "thumbnail getZoomImage p10: so far have " + aImageSrc);

    // For tiny tumblr profile thumbs change 
    // http://30.media.tumblr.com/avatar_a1aefbaa780f_16.png to
    // http://30.media.tumblr.com/avatar_a1aefbaa780f_128.png ; also as
    // https://gs1.wac.edgecastcdn.net/8019B6/data.tumblr.com/avatar_c9703e0bc252_64.png
    // TODO: Similar changes would help for images in archives, changing 128 to 400, 500, or 1280.
    // But we aren't guaranteed that those sizes exist so we don't handle that case.
    let tumblrRegExp = /(\.tumblr\.com\/avatar_[a-f0-9]+)_[0-9][0-9]\./;
    aImageSrc = aImageSrc.replace(tumblrRegExp, "$1_128.");

    // For Google Play Android Apps, change
    // https://lh6.ggpht.com/JAPlPOSg988jbSWvtxUjFObCguHOJk1yB1haLgUmFES_r7ZhAZ-c7WQEhC3-Sz9qDT0=h230 to
    // https://lh6.ggpht.com/JAPlPOSg988jbSWvtxUjFObCguHOJk1yB1haLgUmFES_r7ZhAZ-c7WQEhC3-Sz9qDT0 and
    // and ...=w124 and ...==w78-h78
    let googlePlayRegExp = new RegExp("(\\.ggpht\\.com/.*)=[-wh0-9]+$");
    let aImageSrc = aImageSrc.replace(googlePlayRegExp, "$1");
    
    // For Wordpress and (formerly) Bing Images, etc., get URL from
    // imgurl=... part.
    // eg, change:
    // http://s2.wp.com/imgpress?w=222&url=http%3A%2F%2Fthreehundredsixtysixdaysdotcom.files.wordpress.com%2F2012%2F02%2Fvalentines_me.jpg to
    // http://threehundredsixtysixdaysdotcom.files.wordpress.com/2012/02/valentines_me.jpg
    let imgurlEx = /.*[\?&](img_?)?url=([^&]+).*$/;
    if (imgurlEx.test(aImageSrc)) {
      aImageSrc = aImageSrc.replace(imgurlEx, "$2");
      aImageSrc = decodeURIComponent(aImageSrc);
      if (! /^https?:\/\/./i.test(aImageSrc)) {
        ThumbnailZoomPlus.Pages._logger.debug("getZoomImage: adding http:// prefix after finding url=" +
                                              aImageSrc);
        aImageSrc = "http://" + aImageSrc;
      }
    }
    if (verbose) ThumbnailZoomPlus.Pages._logger.debug(
            "thumbnail getZoomImage p20: so far have " + aImageSrc);
    
    // For wordpress, change:
    // http://trulybogus.files.wordpress.com/2012/02/p2126148.jpg?w=150&h=104 to
    // http://trulybogus.files.wordpress.com/2012/02/p2126148.jpg
    // Similarly for http://wsj2day.files.wordpress.com/2012/03/wsj4060.jpg?w=72&crop=1&h=72
    let wordpressEx = new RegExp("https?://[^/]+\\.files\\.wordpress\\.com/");
    if (wordpressEx.test(aImageSrc)) {
      aImageSrc = aImageSrc.replace(/[?&]w=[0-9]+/, "");
      aImageSrc = aImageSrc.replace(/[?&]h=[0-9]+/, "");
      aImageSrc = aImageSrc.replace(/[?&]crop=[0-9]+/, "");
    }
    
    // gravatar (eg wordpress profile images):
    // https://2.gravatar.com/avatar/bdd58a13c7539fe81d07607a3aac6cd5?s=100&d=https%3A%2F%2Fsecure.gravatar.com... becomes
    // https://2.gravatar.com/avatar/bdd58a13c7539fe81d07607a3aac6cd5?s=300 (or any size).
    aImageSrc = aImageSrc.replace(/(gravatar\.com\/avatar\/.*?[\?&])s=.*/,
                                  "$1s=300");
                                  
    // egotastic.com, etc. (various wordpress sites); 
    // http://cdn02.cdn.egotastic.com/wp-content/uploads/2012/04/30/miley-cyrus-striped-top-pilates-07-94x94.jpg becomes
    // http://cdn02.cdn.egotastic.com/wp-content/uploads/2012/04/30/miley-cyrus-striped-top-pilates-07.jpg
    before = aImageSrc;
    let wpContentEx = new RegExp("(/wp-content/uploads/.*)-[0-9]+x[0-9]+(" + 
                                 EXTS + ")");
    aImageSrc = aImageSrc.replace(wpContentEx, "$1$2");
    if (aImageSrc != before) {
      // this rule doesn't always work so don't show error indicator.
      flags.noErrorIndicator = true;
    }
    
    // For blogger aka Blogspot, change
    // http://3.bp.blogspot.com/-3LhFo9B3BFM/T0bAyeF5pFI/AAAAAAAAKMs/pNLJqyZogfw/s500/DSC_0043.JPG to
    // http://3.bp.blogspot.com/-3LhFo9B3BFM/T0bAyeF5pFI/AAAAAAAAKMs/pNLJqyZogfw/s1600/DSC_0043.JPG; change
    // http://1.bp.blogspot.com/-cCrMafs3SJ4/TwcFrqD23II/AAAAAAAABCg/3GxEgPh0qRQ/s320-p/Tiara+Riley.jpeg to
    // http://1.bp.blogspot.com/-cCrMafs3SJ4/TwcFrqD23II/AAAAAAAABCg/3GxEgPh0qRQ/s1600-p/Tiara+Riley.jpeg
    // NOTE: This rule exists in both Others and Thumbnails, and should be the same in both.
    let blogspotRegExp = new RegExp("(\\.(blogspot|blogger)\\.com/.*)/s[0-9]+(-[a-z])?/([^/?&]+\.[^./?&]*)$");
    aImageSrc = aImageSrc.replace(blogspotRegExp, "$1/s1600/$4");
    
    // For weibo.com profile pics, change
    // http://tp1.sinaimg.cn/1744655144/50/5602386657/0 to
    // http://tp1.sinaimg.cn/1744655144/180/5602386657/0
    aImageSrc = aImageSrc.replace(/(\.sinaimg\.cn\/[0-9]+)\/50\/(.*)/, "$1/180/$2");

    // For weibo.com photos, change
    // http://ww4.sinaimg.cn/thumbnail/4b80c1bdjw1drrv3te5ygj.jpg to
    // http://ww4.sinaimg.cn/large/4b80c1bdjw1drrv3te5ygj.jpg
    aImageSrc = aImageSrc.replace(/(\.sinaimg\.cn)\/thumbnail/, "$1/large");

    aImageSrc = aImageSrc.replace(/\/free_pictures\/thumbs\//, "/free_pictures/normal/");
    
    // For taobao.com, change
    // http://img01.taobaocdn.com/bao/uploaded/i2/T130KYXatnXXXL.Tk3_051312.jpg_310x310.jpg to
    // http://img01.taobaocdn.com/bao/uploaded/i2/T130KYXatnXXXL.Tk3_051312.jpg
    // sim for http://img02.taobaocdn.com/bao/uploaded/i2/T1zrSVXitjXXaE.Ufb_095429.jpg_b.jpg
    aImageSrc = aImageSrc.replace(new RegExp("(/bao/.*\\.jpg)_(?:[0-9]+x[0-9]+|[a-z]+)\\.jpg$"), "$1");
    
    // For leBonCoin.fr: image URLs don't contain the site domainname, so instead
    // we verify the site using baseURI.
    let leBonCoinSiteRegExp = new RegExp("\\.leboncoin\\.fr/", "i");
    if (leBonCoinSiteRegExp.test(node.baseURI)) {
      // change
      // http://193.164.197.30/thumbs/171/1716737621.jpg to
      // http://193.164.197.30/images/171/1716737621.jpg
      let leBonCoinRegExp = new RegExp("/thumbs/([0-9]+/[0-9]+" + 
                                       EXTS +
                                       ")");
      aImageSrc = aImageSrc.replace(leBonCoinRegExp, "/images/$1");
    }
    
    if (verbose) ThumbnailZoomPlus.Pages._logger.debug(
            "thumbnail getZoomImage p30: so far have " + aImageSrc);

    // minus.com
    let minusRegexp = new RegExp("([.\\/]minus\\.com/.*)_(e|xs)\\.jpg");
    if (verbose) ThumbnailZoomPlus.Pages._logger.debug(
            "thumbnail getZoomImage: testing " + aImageSrc + " against " + minusRegexp +
            ": " + minusRegexp.test(aImageSrc));
    aImageSrc = aImageSrc.replace(minusRegexp, "$1.jpg");

    if (verbose) ThumbnailZoomPlus.Pages._logger.debug(
            "thumbnail getZoomImage p40: so far have " + aImageSrc);

    // For 500px.com change
    // http://pcdn.500px.net/6151440/23d1e866fda841f169e5f1bc5a329a7c217392cd/2.jpg to
    // http://pcdn.500px.net/6151440/23d1e866fda841f169e5f1bc5a329a7c217392cd/4.jpg
    aImageSrc = aImageSrc.replace(new RegExp("(https?://[^/?]*\\.500px\\.net/.*)/[123](" + 
                                  EXTS + ")"),
                                  "$1/4$2");
    
    // vimeo.com:
    // http://b.vimeocdn.com/ts/313/757/313757860_150.jpg becomes
    // http://b.vimeocdn.com/ts/313/757/313757860_640.jpg
    aImageSrc = aImageSrc.replace(/(\.vimeocdn\.com\/.*\/[0-9]+)_[0-9]{2,3}\.jpg/,
                                  "$1_640.jpg");
    // http://b.vimeocdn.com/ps/116/353/1163539_75.jpg (profile pic) becomes
    // http://b.vimeocdn.com/ps/116/353/1163539_300.jpg
    aImageSrc = aImageSrc.replace(/(\.vimeocdn\.com\/ps\/.*\/[0-9]+)_[0-9]{2,3}\.jpg/,
                                  "$1_300.jpg");
    
    
    // dailymotion.com:
    // http://static2.dmcdn.net/static/video/920/961/47169029:jpeg_preview_sprite.jpg becomes
    // http://static2.dmcdn.net/static/video/920/961/47169029:jpeg_preview_large.jpg
    aImageSrc = aImageSrc.replace(/(\.dmcdn\.net\/static\/video\/.*:jpeg_preview)_(?:sprite|small|medium)/,
                                  "$1_large");
    // http://static2.dmcdn.net/static/user/783/119/35911387:avatar_small.jpg?20100906012025 becomes
    // http://static2.dmcdn.net/static/user/783/119/35911387:avatar_large.jpg?20100906012025
    aImageSrc = aImageSrc.replace(/(\.dmcdn\.net\/static\/user\/.*:avatar)_(?:sprite|small|medium)/,
                                  "$1_large");
    
    // For some sites where /images/thumb/(digits) changes thumb to full.
    // This really belongs more in the Others rule, but it often wouldn't
    // work since it'd instead follow the <a> link around the image.
    let regEx = new RegExp("(/images)/(thumb|mini)/([0-9]+/[0-9]+/[0-9]+\.)");
    aImageSrc = aImageSrc.replace(regEx, "$1/full/$3");
    
    // For xh*ster.com, change 000/014/111/004_160.jpg to 000/014/111/004_1000.jpg
    let regEx = new RegExp("(xh[a-z0-9]*ster.com.*/[0-9]+/[0-9]+/[0-9]+/[0-9]+)_[0-9]{1,3}(\.[a-z]+)");
    aImageSrc = aImageSrc.replace(regEx, "$1_1000$2");
    
    aImageSrc = aImageSrc.replace(new RegExp("/uploaded_pics/thumbs/(pha.[0-9]+\.)"), "/uploaded_pics/$1");
    
    aImageSrc = aImageSrc.replace(/\/livesnap100\//, "/livesnap320/");
    
    aImageSrc = aImageSrc.replace(/(fantasti\..*\/+big\/.*)\/thumb[\/]/i, 
                                  "$1/");
    
    aImageSrc = aImageSrc.replace(/(\/cms\/ul\/)t-([0-9]{4,20})/, "$1$2");
    
    // Sites using Piwigo image gallery, eg
    // http://www.worldwidefieldguide.com/galleries/Plantae/Ranunculales/Ranunculaceae/Pulsatilla/vulgaris/thumbnail/TN-DSCN0585.jpg becomes
    // http://www.worldwidefieldguide.com/galleries/Plantae/Ranunculales/Ranunculaceae/Pulsatilla/vulgaris/DSCN0585.jpg
    if ("thumbnail" == nodeClass && 
        "wrap2" == node.parentNode.parentNode.getAttribute("class")) {
      aImageSrc = aImageSrc.replace("/thumbnail/TN-", "/");
    }
    
    // td-galerie:
    // http://raxanathos.free.fr/modules/td-galerie/mini/20070407230812-4.jpg becomes
    // http://raxanathos.free.fr/modules/td-galerie/imgs/20070407230812-3.jpg
    aImageSrc = aImageSrc.replace("modules/td-galerie/mini/", "modules/td-galerie/imgs/");
    
    // Google Play album: change
    // https://lh4.googleusercontent.com/Z0AD4MsVIa8qoMs69GmZqNRHq-dzapfbO_HrviLyBmmbgnwi1_YmhId29CojSoERSbdrqEMonBU=w128 to
    // https://lh4.googleusercontent.com/Z0AD4MsVIa8qoMs69GmZqNRHq-dzapfbO_HrviLyBmmbgnwi1_YmhId29CojSoERSbdrqEMonBU=w1000
    // and
    // https://encrypted.google.com/books?id=bgMiAFs66bwC&printsec=frontcover&img=2&zoom=2&source=ge-web-market to
    // https://encrypted.google.com/books?id=bgMiAFs66bwC&printsec=frontcover&img=2&zoom=0&source=ge-web-market
    aImageSrc = aImageSrc.replace(/(\.googleusercontent\.com\/.*=)w[0-9][0-9][0-9]?$/, "$1w1000");
    aImageSrc = aImageSrc.replace(/(\.google\.com\/books?.*)&zoom=1&/, "$1&zoom=0&");

    // For diasp.org:
    // https://diasp.org/uploads/images/thumb_small_d4abd1cd065ed5746b01.jpg ->
    // https://diasp.org/uploads/images/d4abd1cd065ed5746b01.jpg
    // https://joindiaspora.com/uploads/images/thumb_small_Tf3hixImiB4d06d4482c174313aa001347.jpeg
    aImageSrc = aImageSrc.replace(new RegExp("/uploads/images/thumb_small_([a-z0-9]+" +
                                             EXTS + ")", "i"),
                                             "/uploads/images/$1");
    
    // meetup.com
    // http://photos3.meetupstatic.com/photos/event/4/a/1/c/global_131178972.jpeg becomes
    // http://photos3.meetupstatic.com/photos/event/4/a/1/c/highres_131178972.jpeg
    aImageSrc = aImageSrc.replace(/(\.meetupstatic\.com\/photos\/(?!member.*).*\/)(?:global|thumb|member|iab120x90)_(.*\.jpeg)/,
                                  "$1highres_$2");
    // Note that member pics sometimes have highres, but sometimes member size is the
    // highest available.  If we're already displaying 'member', popup 'highres'.
    // http://photos3.meetupstatic.com/photos/member/9/6/c/thumb_26162412.jpeg becomes
    // http://photos3.meetupstatic.com/photos/member/9/6/c/member_26162412.jpeg
    aImageSrc = aImageSrc.replace(/(\.meetupstatic\.com\/photos\/member\/.*\/)member_(.*\.jpeg)/,
                                  "$1highres_$2");
    if (/mem-photo-small/.test(node.parentNode.getAttribute("class"))) {
      // We don't popup large member photos from thumbs for which the site shows its
      // own popup.
      // http://photos3.meetupstatic.com/photos/member/9/6/c/thumb_26162412.jpeg becomes
      // http://photos3.meetupstatic.com/photos/member/9/6/c/member_26162412.jpeg
      aImageSrc = aImageSrc.replace(/(\.meetupstatic\.com\/photos\/member\/.*\/)(?:global|thumb|member|iab120x90)_(.*\.jpeg)/,
                                  "$1member_$2");
    }

    // rostr.d.....com:
    // https://rostr....com/ROSTRWS/rest/photos/rostrid/12345678/width/32/height/32/aspect/true/fill/true becomes
    // https://rostr....com/ROSTRWS/rest/photos/rostrid/12345678/width/32/height/150
    aImageSrc = aImageSrc.replace(/^(https?:\/\/rostr\..*\.com\/.*\/rostrid\/[0-9]+\/width)\/.*/,
                                  "$1/150");
                                  
    // modelmayhem.com:
    // http://photos.modelmayhem.com/avatars/6/1/6/5/8/3/4f8d45b8e42d2_t.jpg to
    // http://photos.modelmayhem.com/avatars/6/1/6/5/8/3/4f8d45b8e42d2_m.jpg
    aImageSrc = aImageSrc.replace(new RegExp("^(https?://photos\\.modelmayhem\\.com/avatars/.*)_t(" + 
                                             EXTS + ")", "i"),
                                             "$1_m$2");
    // http://photos.modelmayhem.com/photos/111202/20/4ed9ac558b0ef_m.jpg to
    // http://photos.modelmayhem.com/photos/111202/20/4ed9ac558b0ef.jpg
    aImageSrc = aImageSrc.replace(new RegExp("^(https?://photos\\.modelmayhem\\.com/photos/.*)_[a-z](" + 
                                             EXTS + ")", "i"),
                                             "$1$2");

    // viddy.com (see also in Others rule):
    // http://cdn.viddy.com/images/users/thumb/15dfd804-ab4f-4998-a1f4-fc56277fe0b3_150x150.jpg to
    // http://cdn.viddy.com/images/users/15dfd804-ab4f-4998-a1f4-fc56277fe0b3.jpg
    aImageSrc = aImageSrc.replace(new RegExp("^(https?://[^/]+\\.viddy\\.com/.*)/thumb/(.*)_[0-9]+x[0-9]+(" + 
                                             EXTS + ")", "i"),
                                             "$1/$2$3");
    
    // imageporter.com
    aImageSrc = aImageSrc.replace(/(imageporter\.com\/.*)_t\.jpg/, "$1.jpg");

    aImageSrc = aImageSrc.replace(new RegExp("^(https?://images[0-9]*\\.pin[a-z]+\\.com/" +
                                             "images/pin[a-z]+/[0-9]+/[0-9]+/[0-9]+)/[0-9x]+/" +
                                             "([0-9a-z]+" + EXTS + ")", "i"),
                                  "$1/620/$2");
    // imagetwist:
    // http://img8.imagetwist.com/th/01282/999sz25wbi76.jpg becomes
    // http://img8.imagetwist.com/i/01282/999sz25wbi76.jpg
    aImageSrc = aImageSrc.replace(/(\.imagetwist\.com\/)th\//, "$1i/");

    // imgchili.com:
    // http://t2.imgchili.com/7428/9998984_ie_011.jpg becomes
    // http://i2.imgchili.com/7428/9998984_ie_011.jpg
    aImageSrc = aImageSrc.replace(/:\/\/t([0-9]+\.imgchili\.com\/)/, "://i$1/");

    // pixiv.net
    // http://img29.pixiv.net/img/puppy/12345678_s.jpg becomes
    // http://img29.pixiv.net/img/puppy/12345678_m.jpg
    aImageSrc = aImageSrc.replace(new RegExp("(pixiv.net/img/.*)_s(" + 
                                             EXTS + ")", "i"),
                                             "$1_m$2");
    // http://img01.pixiv.net/img/ajoritas/1234567_100.jpg?ctype=ranking becomes
    // http://img01.pixiv.net/img/ajoritas/1234567_m.jpg?ctype=ranking 
    aImageSrc = aImageSrc.replace(new RegExp("(pixiv.net/img/.*)_[0-9]{2,3}(" + 
                                             EXTS + ")", "i"),
                                             "$1_m$2");
    
    // xuite.net
    // http://c.share.photo.xuite.net/konwewe/1c8dee9/5609298/217205911_c.jpg becomes
    // http://c.share.photo.xuite.net/konwewe/1c8dee9/5609298/217205911_x.jpg
    aImageSrc = aImageSrc.replace(/(:\/\/[^/]*photo\.xuite\.net\/.*\/[0-9]+)_[a-z]\.jpg/i, 
                                  "$1_x.jpg");

    // photo.net
    // http://static.photo.net/thumbnails/97/42/9742906-tn-lg.jpg becomes
    // http://gallery.photo.net/photo/9742906-lg.jpg
    // http://thumbs.photo.net/photo/14271073-sm.jpg becomes
    // http://gallery.photo.net/photo/14271073-lg.jpg
    aImageSrc = aImageSrc.replace(/(:\/\/)(?:static|thumbs)\.photo\.net\/.*\/(.*?)-(?:tn-)?[a-z0-9]*\.jpg/i, 
                                  "$1gallery.photo.net/photo/$2-lg.jpg");
    
    // redbox.com
    // http://images.redbox.com/Images/EPC/Thumb150/5584.jpg becomes
    // http://images.redbox.com/Images/EPC/Detail370/5584.jpg
    before = aImageSrc;
    aImageSrc = aImageSrc.replace(/^(https?:\/\/images\.redbox\.com\/Images\/EPC)\/Thumb[0-9]+\/([0-9]+\.jpg)$/i,
                                  "$1/Detail370/$2");
    if (before != aImageSrc) {
      flags.popupAvoiderLREdge = 1;
      flags.popupAvoiderWidth = 422;
    }
    
    // weheartit.com uses 
    // http://data.whicdn.com/images/24321233/6cj4w2c9qtgj_large.jpg ->
    // http://data.whicdn.com/images/24321233/6cj4w2c9qtgj_thumb.jpg
    aImageSrc = aImageSrc.replace(/(data\.whicdn\.com\/images\/.*)_thumb\.jpg/,
                                  "$1_large.jpg");
    
    // Huffingtonpost.com
    // http://i.huffpost.com/gen/574638/thumbs/s-MILA-KUNIS-WITHOUT-MAKEUP-154x114.jpg becomes
    // http://i.huffpost.com/gen/574638/thumbs/o-MILA-KUNIS-WITHOUT-MAKEUP-570.jpg
    // can also be -mini, -small.  Note that occasionally o-*570 doesn't exist,
    // but s-*large does.  We fail in that case.
    // .../a- case seen on aol.com
    aImageSrc = aImageSrc.replace(/^(https?:\/\/i.huffpost.com\/gen\/.*\/thumbs)\/[as]-(.*)-(mini|small|large|[0-9]+x[0-9]+)[0-9]*\.jpg/i,
                                  "$1/o-$2-570.jpg");
    // http://i.huffpost.com/gen/576806/thumbs/r-SECRET-LIVES-OF-MOMS-medium260.jpg becomes
    // http://i.huffpost.com/gen/576806/thumbs/o-SECRET-LIVES-OF-MOMS-570.jpg
    aImageSrc = aImageSrc.replace(/^(https?:\/\/i.huffpost.com\/gen\/.*\/thumbs)\/r-(.*)-(mini|small|medium|large)[0-9]*\.jpg/i,
                                  "$1/o-$2-570.jpg");

    // smugmug.com
    // http://fotomom.smugmug.com/Daily-Photos/My-Best-Daily-Shots/i-NV2b7Mx/0/Ti/IMG5190Cropped8X10-Ti.jpg becomes
    // http://fotomom.smugmug.com/Daily-Photos/My-Best-Daily-Shots/i-NV2b7Mx/0/L/IMG5190Cropped8X10-L.jpg
    // or src as Th; or dest as X1, X3, or X3 instead of L.
    // Can be on other domains like on http://www.duffyknox.com/Personal/sports/Zion-Memorial-Day-adventure/23261775_gtCnDp#!i=1876521503&k=65764hV
    aImageSrc = aImageSrc.replace(new RegExp("(/[0-9]+/)T[hi](/.*-)T[hi](-.*)?(" + 
                                             EXTS + ")"),
                                  "$1X2$2X2$3$4");
                                  
    // http://papanaturephotography.smugmug.com/Flowers/Papa-Nature-Photography/DSC5217pscrop/804122257_FaNFY-Ti-2.jpg becomes
    // http://papanaturephotography.smugmug.com/Flowers/Papa-Nature-Photography/DSC5217pscrop/804122257_FaNFY-L-2.jpg
    aImageSrc = aImageSrc.replace(new RegExp("^(https?://[^/]*\\.smugmug\\.com/.*-)T[hi](-.*)?(" + 
                                             EXTS + ")"),
                                  "$1X2$2$3");
                                  
    // coppermine gallery, e.g.
    // http://coppermine-gallery.net/demo/cpg15x/ or
    // http://photo.net.ph/albums/userpics/10002/thumb_DSCN5416a.jpg becomes
    // http://photo.net.ph/albums/userpics/10002/DSCN5416a.jpg
    // album names can vary or be nested.
    // http://media.animegalleries.net/albums/rosario_vampire/moka_akashiya/thumb_rosario_moka_0192.jpg becomes
    // http://media.animegalleries.net/albums/rosario_vampire/moka_akashiya/rosario_moka_0192.jpg
    // 
    aImageSrc = aImageSrc.replace(/(\/albums\/[^?&]+\/)thumb_([^?&\/]+\.(jpg|png|gif))/i, 
                                  "$1$2");
    
    // Powered by PhotoPost vBGallery, eg
    // http://www.hondahookup.com/gallery/files/5/2/4/5/9/9/img_20120513_133135_thumb.jpg becomes
    // http://www.hondahookup.com/gallery/files/5/2/4/5/9/9/img_20120513_133135.jpg
    // and parent <a> tag includes "showimage.php".
    // This rule works for many sites, but some images have .jpg in thumb but .JPG in image.
    let photoPostRegEx = new RegExp("(/[0-9]+/.*)_thumb(" + 
                                    EXTS + ")");
    if (photoPostRegEx.test(aImageSrc)) {
      let parentName = String(node.parentNode)
      if (/showimage\.php/.test(parentName)) {
        aImageSrc = aImageSrc.replace(photoPostRegEx, "$1$2");
      }     
    }
    
    //
    aImageSrc = aImageSrc.replace(new RegExp("(tyimg\\.com/thumb)/[a-z]/[a-z]_(.*" + 
                                             EXTS + ")"),
                                  "$1/l/l_$2");
                                  
    // phpThumb (on various sites).  You can test it here if you turn off
    // the Others rule and on the Thumbnails rule (since the site's links are
    // bad): http://phpthumb.sourceforge.net/demo/demo/phpThumb.demo.demo.php
    // eg:
    // http://timmy/phpThumb/phpThumb.php?w=80&h=60&f=png&src=http://timmy/timmy/emp_pix/110024668.jpeg becomes
    // http://timmy/timmy/emp_pix/110024668.jpeg, or
    // http://phpthumb.sourceforge.net/demo/phpThumb.php?src=images/animaple.gif&w=25&f=gif&hash=30654d06a0e509eca0d14d08bf2f01d8 becomes
    // http://phpthumb.sourceforge.net/demo/images/animaple.gif
    before = aImageSrc;
    aImageSrc = aImageSrc.replace(/.*\/phpThumb\.php.*[?&]src=([^&]*).*/i,
                                  "$1");
    if (before != aImageSrc) {
      aImageSrc = decodeURIComponent(aImageSrc);
      aImageSrc = ThumbnailZoomPlus.FilterService._applyThisBaseURI(node.ownerDocument, before, aImageSrc);
    }
    
    // patch.com (and possily others)
    // http://o1.aolcdn.com/dims-shared/dims3/PATCH/thumbnail/178x88/crop/88x88+45+0/http://hss-prod.hss.aol.com/hss/storage/patch/c7157cb57f56381e37cae1012e591285 becomes
    // http://hss-prod.hss.aol.com/hss/storage/patch/c7157cb57f56381e37cae1012e591285
    //
    // http://o1.aolcdn.com/dims-shared/dims3/PATCH/resize/273x203/http://hss-prod.hss.aol.com/hss/storage/patch/c7157cb57f56381e37cae1012e591285 becomes
    // http://hss-prod.hss.aol.com/hss/storage/patch/c7157cb57f56381e37cae1012e591285
    aImageSrc = aImageSrc.replace(/.*\/(?:resize|thumbnail)\/[0-9]+x[0-9]+(?:\/crop\/[0-9]+x[0-9]+(?:\+[0-9]+\+[0-9]+)?)?\/(https?:\/\/.*)/,
                                  "$1");
    
    // nytimes.com:
    // http://graphics8.nytimes.com/images/2012/06/22/us/JASPER-3/JASPER-3-articleInline.jpg becomes
    // http://graphics8.nytimes.com/images/2012/06/22/us/JASPER-3/JASPER-3-popup.jpg ,
    // http://i1.nyt.com/images/2012/06/22/theater/22MOTH_ASYOU/22MOTH_ASYOU-moth.jpg becomes
    // http://graphics8.nytimes.com/images/2012/06/22/arts/22ASYOU_SPAN/22ASYOU_SPAN-articleLarge.jpg (removes MOTH_)
    // http://i1.nyt.com/images/2012/06/22/arts/22MOTH_HOT/22MOTH_HOT-moth.jpg becomes
    // http://graphics8.nytimes.com/images/2012/06/22/arts/22HOT/22HOT-popup.jpg (removes MOTH_)
    // Some URLs become _SPAN-articleLarge but how do we know which?
    before = aImageSrc;
    aImageSrc = aImageSrc.replace(/(\.(?:nytimes|nyt)\.com\/images\/.*)-(articleInline|moth|thumbStandard|custom[0-9]*|blog[0-9]*)/,
                                  "$1-popup");
    aImageSrc = aImageSrc.replace(/(\.(?:nytimes|nyt)\.com\/images\/.*)-(videoThumb|sfSpan|hpMedium)/,
                                  "$1-articleLarge");
    if (before != aImageSrc) {
      aImageSrc = aImageSrc.replace(/MOTH_/g, "");
      // We don't always know which of -popup or -articleLarge to use.  Our
      // framework doesn't support trying both, so suppress the error indicator.
      flags.noErrorIndicator = true;
    }
    
    // Yelp.com
    // http://s3-media3.ak.yelpcdn.com/photo/QlW1MqiLb7wRp_7NRJxt_w/xs.jpg becomes
    // http://s3-media3.ak.yelpcdn.com/photo/QlW1MqiLb7wRp_7NRJxt_w/l.jpg
    let yelpRe = new RegExp("(\\.yelpcdn\\.com/.*)/[0-9]*(?:xss|xs|ss|s|m|ms)(" + 
                            EXTS + ")", "i");
    aImageSrc = aImageSrc.replace(yelpRe, "$1/l$2");
    ThumbnailZoomPlus.Pages._logger.debug("yelp expr: " + yelpRe);

    // Tripadvisor.com
    // http://media-cdn.tripadvisor.com/media/photo-l/01/f8/09/8a/hotel-pool.jpg becomes
    // http://media-cdn.tripadvisor.com/media/photo-s/01/f8/09/8a/hotel-pool.jpg
    aImageSrc = aImageSrc.replace(new RegExp("(\\.tripadvisor\\.com/media)/photo-[a-z]+/(.*" +
                                             EXTS + ")","i"),
                                  "$1/photo-s/$2");
    // http://media-cdn.tripadvisor.com/media/ProviderThumbnails/dirs/67/2b/672b18107d093b8e21f22da3dca956f92.jpg becomes
    // http://media-cdn.tripadvisor.com/media/ProviderThumbnails/dirs/67/2b/672b18107d093b8e21f22da3dca956f92large.jpg
    aImageSrc = aImageSrc.replace(new RegExp("(\\.tripadvisor\\.com/media/.*/[0-9a-f]+)(?:small|)(" +
                                             EXTS + ")", "i"),
                                  "$1large$2");
    // Tripadvisor uses flipkey.com for vacation rentals.
    // http://images4.flipkey.com/img/photos/losangelesguestsuites/westhollywood3bedroom2bathroom/micro_losangelesguestsuites-westhollywood3bedroom2bathroom-003-1309232550.jpg becomes
    // http://images4.flipkey.com/img/photos/losangelesguestsuites/westhollywood3bedroom2bathroom/640x480_losangelesguestsuites-westhollywood3bedroom2bathroom-003-1309232550.jpg
    aImageSrc = aImageSrc.replace(new RegExp("(\\.flipkey\.com/img/photos/.*)/(?:micro|regular|large)_(.*" + 
                                  EXTS + ")", "i"),
                                  "$1/640x480_$2");
                                  
    // Using the thumb itself as source; don't annoy the user with
    // "too small" warnings, which would be quite common.
    flags.noTooSmallWarning = true;

    if (verbose) ThumbnailZoomPlus.Pages._logger.debug(
            "thumbnail getZoomImage p99: so far have " + aImageSrc);

    return aImageSrc;
  }
};
