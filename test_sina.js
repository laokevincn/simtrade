import fetch from 'node-fetch';

async function test() {
  const res = await fetch('http://hq.sinajs.cn/list=nf_AU0', {
    headers: { 'Referer': 'https://finance.sina.com.cn/' }
  });
  const text = await res.text();
  console.log(text);
}

test();
