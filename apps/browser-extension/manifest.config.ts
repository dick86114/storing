const manifest = {
  manifest_version: 3,
  name: '乾坤戒浏览器采集',
  description: '一键将当前网页采集到乾坤戒收件箱。',
  version: '0.1.0',
  key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAshylQvIjgqe8ji3uYfXPi+8JJKc6izs5ujShGQFO8GXKQs99RrUfIoot4te4EIs1wWzY55WxNwyRHPFsUp3y/hohob2DfF8ArYa4c8lcY8ZUs2Q8p/TXIgvSwhPjrRFVwtB7qRvYwiqBfz1widgAyeuFMevJblgk8CMcSW9c0bJpzBWNi2KE4T8rpGdN+pZwupdViVu0Vmlzu1c6IfXixfUypGWNTFv/oS0SvlZtuKjE1NlEnVWCKgNO3CCcwTz18CeXBHl/yhZRzohIPib5CblCshvANcCLnympV3eM1qRu7nyHgep3Y0iEn+6RC0G9s8jeK7pSuIM0HCTXcc0T8wIDAQAB',
  icons: {
    '16': 'icons/logo-16.png',
    '32': 'icons/logo-32.png',
    '48': 'icons/logo-48.png',
    '128': 'icons/logo-128.png',
  },
  action: {
    default_title: '采集到乾坤戒',
    default_popup: 'src/popup/index.html',
    default_icon: {
      '16': 'icons/logo-16.png',
      '32': 'icons/logo-32.png',
      '48': 'icons/logo-48.png',
      '128': 'icons/logo-128.png',
    },
  },
  options_ui: {
    page: 'src/options/index.html',
    open_in_tab: true,
  },
  background: {
    service_worker: 'src/background/index.ts',
    type: 'module',
  },
  permissions: ['activeTab', 'storage'],
  optional_host_permissions: ['http://*/*', 'https://*/*'],
};

export default manifest;
