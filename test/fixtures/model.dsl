workspace {
  model {
    user = person "Customer" "Buys stuff"
    shop = softwareSystem "Shop" {
      web = container "Web" "Storefront" "React"
      api = container "API" "Orders" "Go"
      db = container "Database" "Orders store" "Postgres"
    }
    user -> web "Uses"
    web -> api "Calls"
    api -> db "Reads/writes"
  }
}
