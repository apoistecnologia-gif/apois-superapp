import {describe,it,expect} from "bun:test";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import {
  isCustomerHomologationMerchant,
  isCustomerHomologationAddress,
} from "../../.work/entregas/src/lib/customer-public-visibility";

const read=(p:string)=>readFileSync(resolve(".work/entregas",p),"utf8");

describe("APOIS Entregas - public customer sees only non-test records",()=>{
  it("hides clearly named merchant fixtures without deleting their records",()=>{
    for(const slug of [
      "apois-teste-entregas-homologacao-20261029",
      "loja-qa-homologacao",
      "acai-no-grau-integracao",
    ])expect(isCustomerHomologationMerchant({slug})).toBe(true);
    expect(isCustomerHomologationMerchant({name:"Bolos Da Nay",slug:"bolos-da-nay-31e09c"})).toBe(false);
    expect(isCustomerHomologationMerchant(null)).toBe(false);
  });
  it("blocks persisted QA carts with only names, without rejecting normal merchant names",()=>{
    expect(isCustomerHomologationMerchant({name:"APOIS TESTE Entregas"})).toBe(true);
    expect(isCustomerHomologationMerchant({name:"Loja QA Homologacao"})).toBe(true);
    expect(isCustomerHomologationMerchant({name:"Açaí no Grau"})).toBe(true);
    expect(isCustomerHomologationMerchant({name:"Restaurante Dom João"})).toBe(false);
  });
  it("does not treat TESTE addresses as real delivery destinations",()=>{
    for(const label of ["TESTE — Centro de Itainópolis (não entregar)", "TESTE APOIS — Centro (não entregar)", "TESTE - Bairro Centro"]) {
      expect(isCustomerHomologationAddress({label})).toBe(true);
    }
    for(const label of ["Casa","Trabalho","Apartamento", "Casa do Centro"]) {
      expect(isCustomerHomologationAddress({label})).toBe(false);
    }
    expect(isCustomerHomologationAddress(null)).toBe(false);
  });
  it("filters both catalog list and deep-linked merchant detail, preserving active merchant lookup",()=>{
    const s=read("src/lib/catalog.ts");
    expect(s).toContain('(data ?? []).filter((merchant) => !isCustomerHomologationMerchant(merchant))');
    expect(s).toContain('return isCustomerHomologationMerchant(data) ? null : data;');
    expect(s).toContain('eq("is_active", true)');
    expect(s).toContain("fetchMenuCategoriesByMerchant");
    expect(s).toContain("fetchProductsByMerchant");
  });
  it("home and search require explicit real address selection, preserving filters and cart",()=>{
    const home=read("src/routes/inicio.tsx");
    const search=read("src/routes/buscar.tsx");
    for(const s of [home,search]){
      expect(s).toContain("const publicAddress = isCustomerHomologationAddress(addrData) ? null : addrData;");
      expect(s).toContain("setDefaultAddress(publicAddress);");
      expect(s).toContain("fetchMerchants((publicAddress as any).city, (publicAddress as any).state)");
      expect(s).toContain('to: "/enderecos"');
    }
    expect(home).toContain('<AppBottomNav activeTab="inicio"');
    expect(home).toContain("Selecione um endereço real");
    expect(search).toContain('data-apois-entregas-real-address-v1="true"');
    expect(search).toContain("filteredMerchants");
    expect(search).toContain("matchingProducts");
  });
  it("address selection shows only real entries while the original explicit selection RPC remains",()=>{
    const s=read("src/routes/enderecos.tsx");
    expect(s).toContain('filter((address) => !isCustomerHomologationAddress(address))');
    expect(s).toContain('"set_default_customer_address"');
    expect(s).toContain("handleConfirmAddress");
    expect(s).toContain("handleUseCurrentLocation");
  });
  it("checkout blocks legacy test carts/addresses but preserves real coverage and PIX flows",()=>{
    const s=read("src/routes/checkout.tsx");
    expect(s).toContain("if (isCustomerHomologationMerchant(merchant))");
    expect(s).toContain('if (fulfillmentType === "delivery" && isCustomerHomologationAddress(address))');
    expect(s).toContain("setAddress(data && !isCustomerHomologationAddress(data) ?");
    expect(s).toContain("preview_delivery_quote");
    expect(s).toContain("get_order_payment_provider");
    expect(s).toContain("deliveryQuote");
    expect(s).not.toContain("TESTE APOIS - razão:");
  });
});
