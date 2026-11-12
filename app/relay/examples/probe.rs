// Ручная проверка против настоящего сервера: cargo run --example probe -- <хост> <порт> <отпечаток> [секунд]
// Печатает порт ретранслятора и статус раз в секунду; в это время на порт можно ходить curl-ом.
use hudini_relay::{Addr, Relay};
use std::time::Duration;

#[tokio::main]
async fn main() {
    let a: Vec<String> = std::env::args().collect();
    let secs: u64 = a.get(4).and_then(|s| s.parse().ok()).unwrap_or(8);
    let relay = Relay::open(vec![Addr { h: a[1].clone(), port: a[2].parse().unwrap(), net: "lan".into() }], &a[3]).await.unwrap();
    println!("relay port {}", relay.port());
    for _ in 0..secs {
        tokio::time::sleep(Duration::from_secs(1)).await;
        println!("{:?}", relay.status());
    }
}
