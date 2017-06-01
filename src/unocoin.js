var Exchange = require('bitcoin-exchange-client');
var Profile = require('./profile');
var Trade = require('./trade');
var PaymentMedium = require('./payment-medium');
var ExchangeRate = require('./exchange-rate');
var Quote = require('./quote');
var API = require('./api');
var Bank = require('./bank');

var assert = require('assert');

class Unocoin extends Exchange.Exchange {
  constructor (obj, delegate) {
    const api = new API('https://app-api.unocoin.com/');

    super(obj, delegate, api, Trade, Quote, PaymentMedium);

    assert(delegate.getToken, 'delegate.getToken() required');

    this._user = obj.user;
    this._auto_login = obj.auto_login;
    this._offlineToken = obj.offline_token;

    this._api._offlineToken = this._offlineToken;

    this._profile = null;

    this._buyCurrencies = ['INR'];
    this._sellCurrencies = ['INR'];

    this.exchangeRate = new ExchangeRate(this._api);

    this._bank = new Bank(this._api, delegate);
  }

  get profile () {
    return this._profile;
  }

  get hasAccount () { return Boolean(this._offlineToken); }

  get buyCurrencies () { return this._buyCurrencies; }

  get sellCurrencies () { return this._sellCurrencies; }

  get bank () { return this._bank; }

  toJSON () {
    var unocoin = {
      user: this._user,
      offline_token: this._offlineToken,
      auto_login: this._auto_login,
      trades: this._TradeClass.filteredTrades(this._trades)
    };

    return unocoin;
  }

  // Email must be set and verified
  signup () {
    var self = this;
    var runChecks = function () {
      assert(!self.user, 'Already signed up');

      assert(self.delegate, 'ExchangeDelegate required');

      assert(self.delegate.email(), 'email required');
      assert(self.delegate.isEmailVerified(), 'email must be verified');
    };

    var doSignup = function (emailToken) {
      assert(emailToken, 'email token missing');
      return this._api.POST('api/v1/authentication/register', {
        email_id: self.delegate.email()
      }, {
        Authorization: `Bearer ${emailToken}`
      });
    };

    var process = function (res) {
      switch (res.status_code) {
        case 200:
          return res.access_token;
        case 724:
          return Promise.reject({error: 'email_already_used', message: res.message});
        default:
          return Promise.reject(res.status_code, res.message);
      }
    };

    var saveMetadata = function (accessToken) {
      this._user = self.delegate.email();
      this._offlineToken = accessToken;
      this._api._offlineToken = this._offlineToken;
      return this._delegate.save.bind(this._delegate)().then(function () { return; });
    };

    var getToken = function () {
      return this.delegate.getToken.bind(this.delegate)('unocoin', {walletAge: true});
    };

    return Promise.resolve().then(runChecks.bind(this))
                            .then(getToken.bind(this))
                            .then(doSignup.bind(this))
                            .then(process.bind(this))
                            .then(saveMetadata.bind(this));
  }

  fetchProfile () {
    return Profile.fetch(this.api).then(profile => {
      this._profile = profile;
      return profile;
    });
  }

  getBuyCurrencies () {
    return Promise.resolve(this._buyCurrencies);
  }

  getSellCurrencies () {
    return Promise.resolve(this._sellCurrencies);
  }

  getTrades () {
    return super.getTrades(Quote);
  }

  static new (delegate) {
    assert(delegate, 'Unocoin.new requires delegate');
    var object = {
      auto_login: true
    };
    var unocoin = new Unocoin(object, delegate);
    return unocoin;
  }
}

module.exports = Unocoin;
