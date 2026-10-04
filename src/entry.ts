if (new URLSearchParams(location.search).get('preview') === 'nuwa') {
  void import('./nuwa-preview');
} else {
  void import('./main');
}
