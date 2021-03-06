// configuration for showing representatives at different levels of government

var show_federal = false; //change this to false to hide federal results
var show_state   = true;
var show_county  = false;
var show_local   = false;

var geocoder = new google.maps.Geocoder;
var INFO_API = 'https://www.googleapis.com/civicinfo/v2/representatives';

// parsing out division IDs
var federal_pattern = "ocd-division/country:us";
var state_pattern = /ocd-division\/country:us\/state:(\D{2}$)/;
var cd_pattern = /ocd-division\/country:us\/state:(\D{2})\/cd:/;
var sl_pattern = /ocd-division\/country:us\/state:(\D{2})\/(sldl:|sldu:)/;
var county_pattern = /ocd-division\/country:us\/state:\D{2}\/county:\D+/;
var local_pattern = /ocd-division\/country:us\/state:\D{2}\/place:\D+/;
var district_pattern = /ocd-division\/country:us\/district:\D+/;

var federal_offices = ['United States Senate', 'United States House of Representatives']

var social_icon_lookup = {
    'YouTube': 'youtube',
    'Facebook': 'facebook',
    'Twitter': 'twitter',
    'GooglePlus': 'google-plus'
};

var social_link_lookup = {
    'YouTube': 'https://www.youtube.com/user/',
    'Facebook': 'https://www.facebook.com/',
    'Twitter': 'https://twitter.com/',
    'GooglePlus': 'https://plus.google.com/'
};

var selected_state = '';
var selected_county = '';
var selected_local = '';
var all_people = {};
var pseudo_id = 1;
var btn_id = '';
var addressee = '';
var toLine = '';

function addressSearch() {
    var address = $('#address').val();
    address = encodeURIComponent(address);


    var url = 'https://www.googleapis.com/civicinfo/v2/representatives?address=' + address + '&includeOffices=true&levels=administrativeArea1&roles=legislatorlowerbody&roles=legislatorupperbody&key=' + API_KEY;

      $.when($.getJSON(url)).then(function(data){

        var divisions = data['divisions'];
        var officials = data['officials'];
        var offices = data['offices'];

        $('table tbody').empty();

        selected_state = '';
        selected_county = '';
        selected_local = '';
        all_people = {};
        pseudo_id = 1;

        var federal_people = [];
        var state_people = [];
        var county_people = [];
        var local_people = [];



        if (divisions === undefined) {
            $("#no-response-container").show();
            $("#response-container").hide();
        }
        else {
            setFoundDivisions(divisions);


            $.each(divisions, function(division_id, division){

                if (typeof division.officeIndices !== 'undefined'){
                    
                    $.each(division.officeIndices, function(i, office){
                        var office_name = offices[office];
                        var role = offices[office]["roles"][0];

                        $.each(offices[office]['officialIndices'], function(i, official){
                            var info = {
                                'person': null,
                                'office': office_name,
                                'address': null,
                                'channels': null,
                                'phones': null,
                                'urls': null,
                                'emails': null,
                                'division_id': division_id,
                                'pseudo_id': pseudo_id,
                                'btn_id': btn_id,
                                'role': role, 
                                'addressee': addressee
                            };

                            var person = officials[official];
                            info['person'] = person;
                            info['btn_id'] = person.name.replace(/\s+/g, '');
                            var nameArr = person.name.split(' ');
                            var lastName = nameArr[nameArr.length-1];
                            var title;
                            if (info['role'] === 'legislatorUpperBody')
                            { title = "Senator" }
                            else if (info['role']  === 'legislatorLowerBody')
                                { title = "Representative" }
                            info['addressee'] = (title + '%20' + lastName);
                            toLine = info['addressee'];
                            console.log(person.name, title, toLine);

                            if (typeof person.channels !== 'undefined'){
                                var channels = [];
                                $.each(person.channels, function(i, channel){
                                    if (channel.type != 'GooglePlus' && channel.type != 'YouTube') {
                                        channel['icon'] = social_icon_lookup[channel.type];
                                        channel['link'] = social_link_lookup[channel.type] + channel['id'];
                                        channels.push(channel);
                                    }
                                });
                                info['channels'] = channels;
                            }
                            if (typeof person.address !== 'undefined'){
                                info['address'] = person.address;
                            }
                            if (typeof person.phones !== 'undefined'){
                                info['phones'] = person.phones;
                            }
                            if (typeof person.urls !== 'undefined'){
                                info['urls'] = person.urls;
                            }
                            if (typeof person.emails !== 'undefined'){
                                info['emails'] = person.emails;
                            }

                            if(checkFederal(division_id, office_name)) {
                                info['jurisdiction'] = 'Federal Government';
                                federal_people.push(info);
                            } else if (checkState(division_id)) {
                                info['jurisdiction'] = selected_state;
                                state_people.push(info);
                            } else if (checkCounty(division_id)){
                                info['jurisdiction'] = selected_county;
                                county_people.push(info);
                            } else {
                                info['jurisdiction'] = selected_local;
                                local_people.push(info);
                            }
                            all_people[pseudo_id] = info;
                            pseudo_id = pseudo_id + 1;

                        });

                    });
                }
            });


            var template = new EJS({'text': $('#tableGuts').html()});

            if (show_state) {
                if (state_people.length == 0)
                    $('#state-container').hide();
                console.log(state_people);
                $('#state-results tbody').append(template.render({people: state_people}));
            } else {
                $('#state-container').hide()
                $('#state-nav').hide();
            }                

            $('#response-container').show();
            $("#no-response-container").hide();

            // hook up modal stuff
            var modal_template = new EJS({'text': $('#modalGuts').html()});
            $('.btn-contact').off('click');
            $('.btn-contact').on('click', function(){
                var info = all_people[$(this).data('id')];
                $('#contactModalLabel').html("Contact " + info.person.name);
                $('#modalContent').html(modal_template.render({info: info}));
                $('#contactModal').modal('show');
            })
        }
    });
}

function findMe() {
    var foundLocation;
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(function (position) {
            var latitude = position.coords.latitude;
            var longitude = position.coords.longitude;
            var accuracy = position.coords.accuracy;
            var coords = new google.maps.LatLng(latitude, longitude);

            // console.log(coords);

            geocoder.geocode({
                'location': coords
            }, function (results, status) {
                if (status === google.maps.GeocoderStatus.OK) {
                    if (results[1]) {
                        $("#address").val(results[1].formatted_address);
                        addressSearch();
                    }
                }
            });

        }, function error(msg) {
            alert('Please enable your GPS position feature.');
        }, {
            //maximumAge: 600000,
            //timeout: 5000,
            enableHighAccuracy: true
        });
    } else {
        alert("Geolocation API is not supported in your browser.");
    }
};

function setFoundDivisions(divisions){
    
    // reset the labels
    $("#state-nav").hide();
    $("#county-nav").hide();
    $("#local-nav").hide();

    // console.log(divisions)
    $.each(divisions, function(division_id, division){
        if (state_pattern.test(division_id)) {
            selected_state = division.name;
            $("[id^=state-name]").html(selected_state);
            $("#state-nav").show();
        }
        if (county_pattern.test(division_id)) {
            selected_county = division.name;
            $("[id^=county-name]").html(selected_county);
            $("#county-nav").show();
        }
        if (local_pattern.test(division_id) || district_pattern.test(division_id)) {
            selected_local = division.name;
            $("[id^=local-name]").html(selected_local);
            $("#local-nav").show();
        }
    });
}

function checkFederal(division_id, office_name) {
    if( division_id == federal_pattern || 
        cd_pattern.test(division_id) ||
        federal_offices.indexOf(office_name.name) >= 0)
        return true;
    else
        return false; 
}

function checkState(division_id){
    if( state_pattern.test(division_id) ||
        sl_pattern.test(division_id))
        return true;
    else
        return false; 
}

function checkCounty(division_id){
    if( county_pattern.test(division_id))
        return true;
    else
        return false; 
}

function formatParty(party) {
    if (party) {
        if (party == 'Unknown')
            return '';

        var party_letter = party.charAt(0);
        var css_class ='label-ind';
        if (party_letter == 'D')
            css_class ='label-dem';
        else if (party_letter == 'R')
            css_class ='label-rep';

        return "(<span title='" + party + "' class='" + css_class + "'>" + party_letter + "</span>)";
    }
    else
        return '';
}

function toTitleCase(str)
{
    return str.replace(/\w\S*/g, function(txt){return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();});
}

//converts a slug or query string in to readable text
function convertToPlainString(text) {
    if (text === undefined) return '';
    return decodeURIComponent(text);
}

function formatPhone(phone) {
    return phone.replace(/\D/g,'');
}
