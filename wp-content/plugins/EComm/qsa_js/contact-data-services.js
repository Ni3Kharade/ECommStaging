/*! contact-data-services.js | https://github.com/experiandataquality/RealTimeAddress | Apache-2.0
*   Experian Data Quality | https://github.com/experiandataquality */


jQuery(document).ready(function ($) {
    ; (function (window, document, undefined) {

        "use strict";

        // Create ContactDataServices constructor and namespace on the window object (if not already present)
        var ContactDataServices = window.ContactDataServices = window.ContactDataServices || {};

        // Default settings
        ContactDataServices.defaults = {
            input: { placeholderText: "Ex: 123 Main Street, City, State, Zip" },
            formattedAddress: { headingType: "h3", headingText: "Validated address" },
            editAddressText: "Edit address",
            searchAgainText: "Search again",
            useAddressEnteredText: "<em>Enter address manually</em>",
            useSpinner: false,
            language: "en",
            addressLineLabels: [
                "addressLine1",
                "addressLine2",
                "addressLine3",
                "locality",
                "province",
                "postalCode",
                "country"
            ]
        };

        // Constructor method event listener (pub/sub type thing)
        ContactDataServices.eventFactory = function () {
            // Create the events object
            var events = {};

            // Create an object to hold the collection of events
            events.collection = {};

            // Subscribe a new event
            events.on = function (event, action) {
                // Create the property array on the collection object
                events.collection[event] = events.collection[event] || [];
                // Push a new action for this event onto the array
                events.collection[event].push(action);
            };

            // Publish (trigger) an event
            events.trigger = function (event, data) {
                // If this event is in our collection (i.e. anyone's subscribed)
                if (events.collection[event]) {
                    // Loop over all the actions for this event
                    for (var i = 0; i < events.collection[event].length; i++) {
                        // Create array with default data as 1st item
                        var args = [data];

                        // Loop over additional args and add to array
                        for (var a = 2; a < arguments.length; a++) {
                            args.push(arguments[a]);
                        }

                        // Call each action for this event type, passing the args
                        events.collection[event][i].apply(events.collection, args);
                    }
                }
            };

            // Return the new events object to be used by whoever invokes this factory
            return events;
        };

        // Translations
        ContactDataServices.translations = {
            // language / country / property
            en: {
                gbr: {
                    locality: "Town/City",
                    province: "County",
                    postalCode: "Post code"
                },
                usa: {
                    locality: "City",
                    province: "State",
                    postalCode: "Zip code"
                }
            }
            // Add other languages below
        };

        // Method to handle showing of UA (User Assistance) content
        ContactDataServices.ua = {
            banner: {
                show: function (html) {
                    // Retrieve the existing banner
                    var banner = document.querySelector(".ua-banner");

                    // Create a new banner if necessary
                    if (!banner) {
                        var firstChildElement = document.querySelector("body").firstChild;
                        banner = document.createElement("div");
                        banner.classList.add("ua-banner");
                        firstChildElement.parentNode.insertBefore(banner, firstChildElement.nextSibling);
                    }

                    // Apply the HTML content
                    banner.innerHTML = html;
                },
                hide: function () {
                    var banner = document.querySelector(".ua-banner");
                    if (banner) {
                        banner.parentNode.removeChild(banner);
                    }
                }
            }
        };

        // Generate the URLs for the various requests
        ContactDataServices.urls = {
            endpoint: "https://api.edq.com/capture/address/v2/search",
            construct: {
                address: {
                    // Construct the Search URL by appending query, country & take
                    search: function (instance) {
                        var url = ContactDataServices.urls.endpoint;
                        url += "?query=" + instance.currentSearchTerm;
                        url += "&country=" + instance.currentCountryCode;
                        url += "&take=" + (instance.maxSize || instance.picklist.maxSize);
                        url += "&auth-token=" + instance.token;
                        return url;
                    },
                    // Append the token to the Format URL
                    format: function (url, instance) {
                        return url + "&auth-token=" + instance.token;
                    }
                }
            },
            // Get token from query string and set on instance
            getToken: function (instance) {
                if (!instance.token) {
                    instance.token = "d3cbeb63-eb2c-454f-8fa5-ef4a1795d7f5";//ContactDataServices.urls.getParameter("token");
                }
            },
            getParameter: function (name) {
                name = name.replace(/[\[]/, "\\[").replace(/[\]]/, "\\]");
                var regex = new RegExp("[\\?&]" + name + "=([^&#]*)"),
                    results = regex.exec(location.search);
                return results === null ? "" : decodeURIComponent(results[1].replace(/\+/g, " "));
            }
        };

        // Integrate with address searching
        ContactDataServices.address = function (options) {
            // Build our new instance from user custom options
            var instance = options || {};

            // Initialising some defaults
            instance.enabled = true;
            instance.language = instance.language || ContactDataServices.defaults.language;
            instance.useSpinner = instance.useSpinner || ContactDataServices.defaults.useSpinner;
            instance.lastSearchTerm = "";
            instance.currentSearchTerm = "";
            instance.lastCountryCode = "";
            instance.currentCountryCode = "";
            instance.currentSearchUrl = "";
            instance.currentFormatUrl = "";
            instance.placeholderText = instance.placeholderText || ContactDataServices.defaults.input.placeholderText;
            instance.editAddressText = instance.editAddressText || ContactDataServices.defaults.editAddressText;
            instance.searchAgainText = instance.searchAgainText || ContactDataServices.defaults.searchAgainText;
            instance.formattedAddress = instance.formattedAddress || ContactDataServices.defaults.formattedAddress;
            instance.elements = instance.elements || {};

            // Create a new object to hold the events from the event factory
            instance.events = new ContactDataServices.eventFactory();

            // Initialise this instance
            instance.init = function () {
                // Get token from the query string
                ContactDataServices.urls.getToken(instance);
                if (!instance.token) {
                    // Disable searching on this instance
                    instance.enabled = false;
                    // Display a banner informing the user that they need a token
                    ContactDataServices.ua.banner.show("<a href='https://github.com/experiandataquality/RealTimeAddress#tokens'>Please provide a token for RealTimeAddress.</a>");
                    return;
                }

                instance.setCountryList();

                if (instance.elements.input) {
                    instance.input = instance.elements.input;
                    // Bind an event listener on the input
                    instance.input.addEventListener("keyup", instance.search);
                    // Set a placeholder for the input
                    instance.input.setAttribute("placeholder", instance.placeholderText);
                    // Disable autocomplete on the form
                    instance.input.parentNode.setAttribute("autocomplete", "off");
                    // Disable form submission for demo purposes
                    instance.input.parentNode.addEventListener('submit', function (event) {
                        event.preventDefault();
                    });
                    // Apply focus to input
                    instance.input.focus();
                }
            };

            // Main function to search for an address from an input string
            instance.search = function (event) {
                // Handle keyboard navigation
                var e = event || window.event;
                e = e.which || e.keyCode;
                if (e === 38/*Up*/ || e === 40/*Down*/ || e === 13/*Enter*/) {
                    instance.picklist.keyup(e);
                    return;
                }

                instance.currentSearchTerm = instance.input.value;
                //instance.currentCountryCode = $('.optContry:checked').val();//instance.countryList.value;
                instance.currentCountryCode = "usa"; //12/20/2016
                // Check is searching is permitted
                if (instance.canSearch()) {
                    // Abort any outstanding requests
                    if (instance.request.currentRequest) {
                        instance.request.currentRequest.abort();
                    }

                    // Fire an event before a search takes place
                    instance.events.trigger("pre-search", instance.currentSearchTerm);

                    // Construct the new Search URL
                    var url = ContactDataServices.urls.construct.address.search(instance);

                    // Store the last search term
                    instance.lastSearchTerm = instance.currentSearchTerm;

                    // Hide any previous results
                    instance.result.hide();

                    // Hide the inline search spinner
                    instance.searchSpinner.hide();

                    // Show an inline spinner whilst searching
                    instance.searchSpinner.show();

                    // Initiate new Search request
                    instance.request.get(url, instance.picklist.show);
                } else if (instance.lastSearchTerm !== instance.currentSearchTerm) {
                    // Clear the picklist if the search term is cleared/empty
                    instance.picklist.hide();
                }
            };

            instance.setCountryList = function () {
                instance.countryList = instance.elements.countryList;

                // If the user hasn't passed us a country list, then create new list?
                if (!instance.countryList) {
                    instance.createCountryDropdown();
                }
            };

            // Determine whether searching is currently permitted
            instance.canSearch = function () {
                // If searching on this instance is enabled, and
                return (instance.enabled &&
                        // If search term is not empty, and
                        instance.currentSearchTerm !== "" &&
                        // If search term is not the same as previous search term, and
                        instance.lastSearchTerm !== instance.currentSearchTerm &&
                        // If the country is not empty
                        instance.countryList.value !== undefined && instance.countryList.value !== "");
            };

            instance.createCountryDropdown = function () {
                // What countries?
                // Where to position it?
                instance.countryList = {};
            };

            // Get a final (Formatted) address
            instance.format = function (url) {
                // Trigger an event
                instance.events.trigger("pre-formatting-search", url);

                // Hide the searching spinner
                instance.searchSpinner.hide();

                // Construct the format URL (append the token)
                instance.currentFormatUrl = ContactDataServices.urls.construct.address.format(url, instance);

                // Initiate a new Format request
                instance.request.get(instance.currentFormatUrl, instance.result.show);
            };

            instance.picklist = {
                // Set initial size
                size: 0,
                // Set initial max size
                maxSize: 25,
                // Render a picklist of search results
                show: function (items) {
                    // Store the picklist items
                    instance.picklist.items = items.results;

                    // Reset any previously selected current item
                    instance.picklist.currentItem = null;

                    // Update picklist size
                    instance.picklist.size = instance.picklist.items.length;

                    // Get/Create picklist container element
                    instance.picklist.container = instance.picklist.container || instance.picklist.createList();

                    // Ensure previous results are cleared
                    instance.picklist.container.innerHTML = "";

                    // Reset the picklist tab count (used for keyboard navigation)
                    instance.picklist.resetTabCount();

                    // Hide the inline search spinner
                    instance.searchSpinner.hide();

                    // Prepend an option for "use address entered"
                    instance.picklist.useAddressEntered.element = instance.picklist.useAddressEntered.element || instance.picklist.useAddressEntered.create();

                    if (instance.picklist.size > 0) {
                        // Fire an event before picklist is created
                        instance.events.trigger("pre-picklist-create", instance.picklist.items);

                        // Iterate over and show results
                        instance.picklist.items.forEach(function (item) {
                            // Create a new item/row in the picklist
                            var listItem = instance.picklist.createListItem(item);
                            instance.picklist.container.appendChild(listItem);
                            // Listen for selection on this item
                            instance.picklist.listen(listItem);

                        });

                        // Fire an event after picklist is created
                        instance.events.trigger("post-picklist-create");
                        var top = $(".address-picklist").height();
                        $('.use-address-entered').attr('style', 'top:' + top + 'px')
                    }
                },
                // Remove the picklist
                hide: function () {
                    // Clear the current picklist item
                    instance.picklist.currentItem = null;
                    // Remove the "use address entered" option too
                    instance.picklist.useAddressEntered.destroy();
                    // Remove the main picklist container
                    if (instance.picklist.container) {
                        instance.input.parentNode.removeChild(instance.picklist.container);
                        instance.picklist.container = undefined;
                    }
                },
                useAddressEntered: {
                    // Create a "use address entered" option
                    create: function () {
                        var item = {
                            suggestion: ContactDataServices.defaults.useAddressEnteredText,
                            format: ""
                        };
                        var listItem = instance.picklist.createListItem(item);
                        listItem.classList.add("use-address-entered");

                        instance.picklist.container.parentNode.insertBefore(listItem, instance.picklist.container.nextSibling);
                        listItem.addEventListener("click", instance.picklist.useAddressEntered.click);
                        return listItem;
                    },
                    // Destroy the "use address entered" option
                    destroy: function () {
                        if (instance.picklist.useAddressEntered.element) {
                            instance.picklist.container.parentNode.removeChild(instance.picklist.useAddressEntered.element);
                            instance.picklist.useAddressEntered.element = undefined;
                        }
                    },
                    // Use the address entered as the Formatted address
                    click: function () {
                        var inputData = {
                            address: []
                        };

                        if (instance.currentSearchTerm) {
                            // Try and split into lines by using comma delimiter
                            var lines = instance.currentSearchTerm.split(",");
                            if (lines.length > 0) {
                                for (var i = 0; i < lines.length; i++) {
                                    inputData.address.push(instance.picklist.useAddressEntered.formatManualAddressLine(lines, i));
                                }
                            }

                            // Pad with additional blank fields if needed
                            var maxLines = 7;
                            var additionalLinesNeeded = maxLines - lines.length;
                            if (additionalLinesNeeded > 0) {
                                var counterStart = maxLines - additionalLinesNeeded;
                                for (var j = counterStart; j < maxLines; j++) {
                                    inputData.address.push(instance.picklist.useAddressEntered.formatManualAddressLine([], j));
                                }
                            }
                        }

                        instance.result.show(inputData);
                        instance.result.editAddressManually();
                    },
                    // Create and return an address line object with the key as the label
                    formatManualAddressLine: function (lines, i) {
                        var key = ContactDataServices.defaults.addressLineLabels[i];
                        var lineObject = {};
                        lineObject[key] = lines[i] || "";
                        return lineObject;
                    }
                },
                // Create the picklist container and inject after the input
                createList: function () {
                    var list = document.createElement("div");
                    list.classList.add("address-picklist");
                    // Insert the picklist after the input
                    instance.input.parentNode.insertBefore(list, instance.input.nextSibling);

                    list.addEventListener("keydown", instance.picklist.enter);
                    return list;
                },
                // Create a new picklist item/row
                createListItem: function (item) {
                    var row = document.createElement("div");
                    row.innerHTML = instance.picklist.addMatchingEmphasis(item);
                    // Store the Format URL
                    row.setAttribute("format", item.format);
                    return row;
                },
                // Tab count used for keyboard navigation
                tabCount: -1,
                resetTabCount: function () {
                    instance.picklist.tabCount = -1;
                },
                // Keyboard navigation
                keyup: function (e) {
                    if (!instance.picklist.container) {
                        return;
                    }

                    if (e === 13/*Enter*/) {
                        instance.picklist.checkEnter();
                        return;
                    }

                    // Get a list of all the addresses in the picklist
                    var addresses = instance.picklist.container.querySelectorAll("div"),
                                    firstAddress, lastAddress;

                    // Set the tabCount based on previous and direction
                    if (e === 38/*Up*/) {
                        instance.picklist.tabCount--;
                    }
                    else {
                        instance.picklist.tabCount++;
                    }

                    // Set top and bottom positions and enable wrap-around
                    if (instance.picklist.tabCount < 0) {
                        instance.picklist.tabCount = addresses.length - 1;
                        lastAddress = true;
                    }
                    if (instance.picklist.tabCount > addresses.length - 1) {
                        instance.picklist.tabCount = 0;
                        firstAddress = true;
                    }

                    // Highlight the selected address
                    var currentlyHighlighted = addresses[instance.picklist.tabCount];
                    // Remove any previously highlighted ones
                    var previouslyHighlighted = instance.picklist.container.querySelector(".selected");
                    if (previouslyHighlighted) {
                        previouslyHighlighted.classList.remove("selected");
                    }
                    currentlyHighlighted.classList.add("selected");
                    // Set the currentItem on the picklist to the currently highlighted address
                    instance.picklist.currentItem = currentlyHighlighted;

                    // Scroll address into view, if required
                    var addressListCoords = {
                        top: instance.picklist.container.offsetTop,
                        bottom: instance.picklist.container.offsetTop + instance.picklist.container.offsetHeight,
                        scrollTop: instance.picklist.container.scrollTop,
                        selectedTop: currentlyHighlighted.offsetTop,
                        selectedBottom: currentlyHighlighted.offsetTop + currentlyHighlighted.offsetHeight,
                        scrollAmount: currentlyHighlighted.offsetHeight
                    };
                    if (firstAddress) {
                        instance.picklist.container.scrollTop = 0;
                    }
                    else if (lastAddress) {
                        instance.picklist.container.scrollTop = 999;
                    }
                    else if (addressListCoords.selectedBottom + addressListCoords.scrollAmount > addressListCoords.bottom) {
                        instance.picklist.container.scrollTop = addressListCoords.scrollTop + addressListCoords.scrollAmount;
                    }
                    else if (addressListCoords.selectedTop - addressListCoords.scrollAmount - addressListCoords.top < addressListCoords.scrollTop) {
                        instance.picklist.container.scrollTop = addressListCoords.scrollTop - addressListCoords.scrollAmount;
                    }
                },
                // Add emphasis to the picklist items highlighting the match
                addMatchingEmphasis: function (item) {
                    var highlights = item.matched || [],
                        label = item.suggestion;

                    for (var i = 0; i < highlights.length; i++) {
                        var replacement = '<b>' + label.substring(highlights[i][0], highlights[i][1]) + '</b>';
                        label = label.substring(0, highlights[i][0]) + replacement + label.substring(highlights[i][1]);
                    }

                    return label;
                },
                // Listen to a picklist selection
                listen: function (row) {
                    row.addEventListener("click", instance.picklist.pick.bind(null, row));
                },
                checkEnter: function () {
                    var picklistItem;
                    // If picklist contains 1 address then use this one to format
                    if (instance.picklist.size === 1) {
                        picklistItem = instance.picklist.container.querySelectorAll("div")[0];
                    } // Else use the currently highlighted one when navigation using keyboard
                    else if (instance.picklist.currentItem) {
                        picklistItem = instance.picklist.currentItem;
                    }
                    if (picklistItem) {
                        instance.picklist.pick(picklistItem);
                    }
                },
                // How to handle a picklist selection
                pick: function (item) {
                    // Fire an event when an address is picked
                    instance.events.trigger("post-picklist-selection", item);

                    // Get a final address using picklist item
                    instance.format(item.getAttribute("format"));
                }
            };

            instance.result = {
                // Render a Formatted address
                show: function (data) {
                    // Hide the inline search spinner
                    instance.searchSpinner.hide();

                    // Hide the picklist
                    instance.picklist.hide();

                    // Clear search input
                    //instance.input.value = "";

                    if (data.address.length > 0) {
                        // Fire an event to say we've got the formatted address
                        instance.events.trigger("post-formatting-search", data);

                        // Get formatted address container element
                        //instance.result.formattedAddress = instance.elements.formattedAddress || instance.result.createFormattedAddressContainer();

                        // Create an array to hold the hidden input fields
                        var inputArray = [];
                        var add = "";
                        var CNT = 0;
                        // Loop over each formatted address line
                        for (var i = 0; i < data.address.length; i++) {
                            var line = data.address[i];

                            // The line object will only have one property, but we don't know the key
                            for (var key in line) {
                                if (line.hasOwnProperty(key)) {
                                    // Create the address line row and add to the DOM
                                    //							var row = instance.result.createAddressLine.row(line[key]);
                                    //							//instance.result.formattedAddress.appendChild(row);

                                    //							// Create a hidden input to store the address line as well
                                    //							var label = instance.result.createAddressLine.label(key);
                                    //							inputArray.push(instance.result.createAddressLine.input(label, line[key]));
                                    if (CNT < 6) {
                                        if (line[key] != "") {
                                            if (instance.input.id == "txtPermenet") {
                                                if (CNT == 0) { $('#txtAddressLine1').val(line[key]); }
                                                //  if (CNT == 1) { $('#txtApt').val(line[key]); }
                                                if (CNT == 3) { $('#txtCity').val(line[key]); }
                                                if (CNT == 4) { $('#selState option:selected').val(line[key]); }
                                                if (CNT == 5) { $('#txtZip').val(line[key]); }

                                                $('#txtAddressLine1').removeClass('txtErr');
                                                $('#txtAddressLine1').addClass('txtSuccess');

                                                $('#divPermenetAddrMessage').html('<img src="../wp-content/plugins/EComm/qsa_content/true.png" /><span style="color:green;">Address Validated</span>');
                                            }
                                            else if (instance.input.id == "txtAddressLine1") {
                                                if (CNT == 0) { $('#txtAddressLine1').val(line[key]); }
                                                //alert($('#txtAddressLine1').val());
                                                if (CNT == 1) { $('#txtApt').val(line[key]); }
                                                if (CNT == 3) { $('#txtCity').val(line[key]); }

                                                if (CNT == 4) {
                                                    $('#selState option[value=' + line[key] + ']').attr('selected', 'selected');
                                                    $('#ddlStates option[value=' + line[key] + ']').attr('selected', 'selected');
                                                    $('#ddlState option[value=' + line[key] + ']').attr('selected', 'selected');
                                                    $('.rfdSelectText').html($("#ddlStates option:selected").text());
                                                }
                                                if (CNT == 5) { $('#txtZip').val(line[key]); }

                                                $('#txtAddressLine1').removeClass('txtErr');
                                                $('#divPermenetAddrMessage').html('<img src="../wp-content/plugins/EComm/qsa_content/true.png" /><span style="color:green;">Address Validated</span>');
                                                $('#divPermenetAddrMessage').removeClass('hidden');
                                            }
                                            else if (instance.input.id == "txtBilling") {
                                                if (CNT == 0) { $('#txtBAddressLine').val(line[key]); }
                                                //if (CNT == 1) { $('#txtBApt').val(line[key]); }
                                                if (CNT == 3) { $('#txtBCity').val(line[key]); }
                                                if (CNT == 4) { $('#txtBState').val(line[key]); }
                                                if (CNT == 5) { $('#txtBZip').val(line[key]); }
                                                $('#txtBAddressLine').removeClass('txtcustom');
                                                $('#txtBAddressLine').removeClass('txtErr');
                                                $('#txtBAddressLine').addClass('txtSuccess');
                                                $('#divBillingAddrMessage').html('<img src="../wp-content/plugins/EComm/qsa_content/true.png" /><span style="color:green;">Address Validated</span>');

                                            }
                                            else if (instance.input.id == "txtBillingAddressLine1") {
                                                if (CNT == 0) { $('#txtBillingAddressLine1').val(line[key]); }
                                                if (CNT == 3) { $('#txtBillingCity').val(line[key]); }
                                                if (CNT == 4) { $('#ddlBillingState').val(line[key]); }
                                                if (CNT == 5) { $('#txtBillingZip').val(line[key]); }
                                                $('#txtBillingAddressLine1').removeClass('txtcustom');
                                                $('#txtBillingAddressLine1').removeClass('txtErr');
                                                $('#txtBillingAddressLine1').addClass('txtSuccess');
                                                $('#divBillingAddrMessage').html(" <img src='../wp-content/plugins/EComm/qsa_content/true.png' /><span style='color:green;'>Address Validated</span>");
                                                $('#divBillingAddrMessage').removeClass('hidden');
                                            }
                                        }
                                    }
                                    CNT++;
                                }
                            }
                        }
                        //instance.input.value = add;
                        // Write the list of hidden address line inputs to the DOM in one go
                        //instance.result.renderInputList(inputArray);

                        // Write the 'Edit address' link and insert into DOM
                        //instance.result.createEditAddressLink();

                        // Write the 'Search again' link and insert into DOM
                        //instance.result.createSearchAgainLink();
                    }
                },
                hide: function () {
                    if (instance.result.formattedAddress) {
                        instance.input.parentNode.removeChild(instance.result.formattedAddress);
                        instance.result.formattedAddress = undefined;
                    }
                },
                // Create the formatted address container and inject after the input
                createFormattedAddressContainer: function () {
                    var container = document.createElement("div");
                    container.classList.add("formatted-address");
                    // Create a heading for the formatted address
                    if (instance.formattedAddress.heading !== false) {
                        var heading = document.createElement(instance.formattedAddress.headingType);
                        heading.innerHTML = instance.formattedAddress.headingText;
                        container.appendChild(heading);
                    }
                    // Insert the container after the input
                    instance.input.parentNode.insertBefore(container, instance.input.nextSibling);
                    return container;
                },
                createAddressLine: {
                    // Create a hidden input to store the address line
                    input: function (key, value) {
                        // Create a wrapper (and hide it)
                        var div = document.createElement("div");
                        div.classList.add("hidden");
                        div.classList.add("address-line-input");

                        // Create the label
                        var label = document.createElement("label");
                        label.innerHTML = key.replace(/([A-Z])/g, ' $1') //Add space before capital Letters
                                             .replace(/([0-9])/g, ' $1') //Add space before numbers
                                             .replace(/^./, function (str) { return str.toUpperCase(); }); //Make first letter of word a capital letter
                        div.appendChild(label);

                        // Create the input
                        var input = document.createElement("input");
                        input.setAttribute("type", "text");
                        input.setAttribute("name", key);
                        input.setAttribute("value", value);
                        div.appendChild(input);
                        return div;
                    },
                    // Create a DOM element to contain the address line
                    row: function (value) {
                        var row = document.createElement("div");
                        row.classList.add("toggle");
                        row.innerHTML = value;
                        return row;
                    },
                    // Create the address line label based on the country and language
                    label: function (key) {
                        var label = key;
                        var language = instance.language;
                        var country = instance.currentCountryCode;
                        var translations = ContactDataServices.translations;
                        if (translations) {
                            try {
                                var translatedLabel = translations[language][country][key];
                                if (translatedLabel) {
                                    label = translatedLabel;
                                }
                            } catch (e) {
                                // Translation doesn't exist for key
                            }
                        }
                        return label;
                    }
                },
                // Create the 'Edit address' link that allows manual editing of address
                createEditAddressLink: function () {
                    var link = document.createElement("a");
                    link.setAttribute("href", "#");
                    link.classList.add("edit-address-link");
                    link.innerHTML = instance.editAddressText;
                    // Insert into the formatted address container
                    instance.result.formattedAddress.appendChild(link);
                    // Bind event listener
                    link.addEventListener("click", instance.result.editAddressManually);
                },
                // Create the 'Search again' link that resets the search
                createSearchAgainLink: function () {
                    var link = document.createElement("a");
                    link.setAttribute("href", "#");
                    link.classList.add("search-again-link");
                    link.innerHTML = instance.searchAgainText;
                    // Insert into the formatted address container
                    instance.result.formattedAddress.appendChild(link);
                    // Bind event listener
                    link.addEventListener("click", instance.reset);
                },
                editAddressManually: function (event) {
                    if (event) {
                        event.preventDefault();
                    }
                    if (instance.input.id == "txtPermenet") {


                        $('#txtAddressLine1').addClass('txtErr');
                        $('#divPermenetAddrMessage').html(" <img src='../wp-content/plugins/EComm/Images/warning.png' /><span style='color:red;padding-left:5px;'>Address is not validated, it will save invalid/following  address</span>");
                    }
                    else if (instance.input.id == "txtBilling") {
                        $('#txtBAddressLine').removeClass('txtcustom');
                        $('#txtBAddressLine').removeClass('txtSuccess');
                        $('#txtBAddressLine').addClass('txtErr');
                        $('#divBillingAddrMessage').html(" <img src='../wp-content/plugins/EComm/Images/warning.png' /><span style='color:red;padding-left:5px;'>Address is not validated, it will save invalid/following  address</span>");

                    }
                    else if (instance.input.id == "txtBAddressLine") {
                        $('#txtBAddressLine').removeClass('txtcustom');
                        $('#txtBAddressLine').removeClass('txtSuccess');
                        $('#txtBAddressLine').addClass('txtErr');
                        $('#divBillingAddrMessage').html(" <img src='../wp-content/plugins/EComm/Images/warning.png' /><span style='color:red;padding-left:5px;'>Address is not validated, it will save invalid/following  address</span>");
                    }
                    // Remove 'edit address link'
                    //instance.result.formattedAddress.querySelector(".edit-address-link").classList.add("hidden");

                    // Change the visible formatted address to hidden
                    //instance.toggleVisibility(instance.result.formattedAddress);

                    // Change the hidden address line inputs to show to allow editing
                    //			var addressLineInputs = instance.result.formattedAddress.querySelectorAll(".address-line-input");
                    //			for (var j = 0; j < addressLineInputs.length; j++) {
                    //					addressLineInputs[j].classList.remove("hidden");
                    //			}
                },
                // Write the list of hidden address line inputs to the DOM
                renderInputList: function (inputArray) {
                    if (inputArray.length > 0) {
                        for (var i = 0; i < inputArray.length; i++) {
                            instance.result.formattedAddress.appendChild(inputArray[i]);
                        }
                    }
                }
            };

            // Toggle the visibility of elements
            instance.toggleVisibility = function (scope) {
                //		scope = scope || document;
                //		var elements = scope.querySelectorAll(".toggle");
                //		for (var i = 0; i < elements.length; i++) {
                //			if(elements[i].classList.contains("hidden")){
                //				elements[i].classList.remove("hidden");
                //			} else {
                //				elements[i].classList.add("hidden");
                //			}
                //		}
            };

            instance.searchSpinner = {
                show: function () {
                    // Return if we're not displaying a spinner
                    if (!instance.useSpinner) {
                        return;
                    }
                    // Create the spinner container
                    var spinnerContainer = document.createElement("div");
                    spinnerContainer.classList.add("loader");
                    spinnerContainer.classList.add("loader-inline");

                    // Create the spinner
                    var spinner = document.createElement("div");
                    spinner.classList.add("spinner");
                    spinnerContainer.appendChild(spinner);

                    // Insert the spinner after the field
                    instance.input.parentNode.insertBefore(spinnerContainer, instance.input.nextSibling);
                },

                hide: function () {
                    // Return if we're not displaying a spinner
                    if (!instance.useSpinner) {
                        return;
                    }
                    var spinner = instance.input.parentNode.querySelector(".loader-inline");
                    if (spinner) {
                        instance.input.parentNode.removeChild(spinner);
                    }
                }
            };

            // Reset the search
            instance.reset = function (event) {
                if (event) {
                    event.preventDefault();
                }
                // Enable searching
                instance.enabled = true;
                // Hide formatted address
                instance.result.hide();
                // Show search input
                instance.toggleVisibility(instance.input.parentNode);
                // Apply focus to input
                instance.input.focus();

                // Fire an event after a reset
                instance.events.trigger("post-reset");
            };

            // How to handle request errors
            instance.handleError = {
                // How to handle 400 Bad Request
                badRequest: function (xhr) {
                    instance.enabled = false;

                    // As searching is disabled, show button to render final address instead
                    instance.handleError.showSubmitButton();

                    // Fire an event to notify users of the error
                    instance.events.trigger("request-error-400", xhr);
                },

                // How to handle 401 Unauthorized (invalid token?) requests
                unauthorized: function (xhr) {
                    instance.enabled = false;

                    // As searching is disabled, show button to render final address instead
                    instance.handleError.showSubmitButton();

                    // Fire an event to notify users of the error
                    instance.events.trigger("request-error-401", xhr);
                },

                // How to handle 403 Forbidden requests
                forbidden: function (xhr) {
                    instance.enabled = false;

                    // As searching is disabled, show button to render final address instead
                    instance.handleError.showSubmitButton();

                    // Fire an event to notify users of the error
                    instance.events.trigger("request-error-403", xhr);
                },

                // How to handle 404 Not Found requests
                notFound: function (xhr) {
                    instance.enabled = false;

                    // As searching is disabled, show button to render final address instead
                    instance.handleError.showSubmitButton();

                    // Fire an event to notify users of the error
                    instance.events.trigger("request-error-404", xhr);
                },

                // As searching is disabled, show button to render final address instead
                showSubmitButton: function () {
                    var button = document.createElement("button");
                    button.innerText = "Submit";
                    instance.input.parentNode.insertBefore(button, instance.input.nextSibling);
                    button.addEventListener("click", function () {
                        // Simulate a manual "use address entered" entry
                        //instance.picklist.useAddressEntered.click();
                        // Remove the button
                        //instance.input.parentNode.removeChild(button);
                        $addressPlugin.verify();
                    });
                }
            };

            // Use this to initiate and track XMLHttpRequests
            instance.request = {
                currentRequest: null,
                get: function (url, callback) {
                    instance.request.currentRequest = new XMLHttpRequest();
                    instance.request.currentRequest.open('GET', url, true);
                    instance.request.currentRequest.timeout = 5000; // 5 seconds

                    instance.request.currentRequest.onload = function (xhr) {
                        if (instance.request.currentRequest.status >= 200 && instance.request.currentRequest.status < 400) {
                            // Success!
                            var data = JSON.parse(instance.request.currentRequest.responseText);
                            callback(data);
                        } else {
                            // We reached our target server, but it returned an error
                            instance.searchSpinner.hide();

                            // Fire an event to notify users of an error
                            instance.events.trigger("request-error", xhr);

                            // If the request is 400 Bad Request
                            if (instance.request.currentRequest.status === 400) {
                                instance.handleError.badRequest(xhr);
                            }
                                // If the request is 401 Unauthorized (invalid token) we should probably disable future requests
                            else if (instance.request.currentRequest.status === 401) {
                                instance.handleError.unauthorized(xhr);
                            }
                                // If the request is 403 Forbidden
                            else if (instance.request.currentRequest.status === 403) {
                                instance.handleError.forbidden(xhr);
                            }
                                // If the request is 404 Not Found
                            else if (instance.request.currentRequest.status === 404) {
                                instance.handleError.notFound(xhr);
                            }
                        }
                    };

                    instance.request.currentRequest.onerror = function (xhr) {
                        // There was a connection error of some sort
                        // Hide the inline search spinner
                        instance.searchSpinner.hide();

                        // Fire an event to notify users of an error
                        instance.events.trigger("request-error", xhr);
                    };

                    instance.request.currentRequest.ontimeout = function (xhr) {
                        // There was a connection timeout
                        // Hide the inline search spinner
                        instance.searchSpinner.hide();

                        // Fire an event to notify users of the timeout
                        instance.events.trigger("request-timeout", xhr);
                    };

                    instance.request.currentRequest.send();
                }
            };

            // Initialise this instance of ContactDataServices
            instance.init();

            // Return the instance object to the invoker
            return instance;
        };

    })(window, window.document);
});

jQuery(document).ready(function ($) {
    $('.optContry').change(function () {
        var options = {
            elements: {
                input: document.querySelector(".search"),
                countryList: document.querySelector("select")
            }
        };

        // Initialise this instance
        var address = new ContactDataServices.address(options);
    });
});
