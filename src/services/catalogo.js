import { supabase } from "../supabase.js";
import { loadAllTableRows } from "./tableRows.js";
const bucket = () => supabase.storage.from("catalogo-produtos");
export async function unwrap(request) {
  const { data, error } = await request;
  if (error) throw error;
  return data;
}
export const catalogImageUrl = path => path ? bucket().getPublicUrl(path).data.publicUrl : "";
export const publicCatalog = async params => {
  if (!supabase) throw Error("Catálogo indisponível. Tente novamente mais tarde.");
  return unwrap(supabase.rpc("catalogo_publico", params));
};
export const saveCatalog = (id, data, version) => unwrap(supabase.rpc("salvar_catalogo", { p_material_id: id, p_dados: data, p_versao: version ?? null }));
export const imageAction = (action, product, image = null, data = {}) => unwrap(supabase.rpc("operar_imagem_catalogo", { p_acao: action, p_produto: product, p_imagem: image, p_dados: data }));
export async function adminCatalog() {
  const results = await Promise.allSettled([
    unwrap(loadAllTableRows(supabase.from("catalogo_produtos").select("*"), ["material_id"])),
    unwrap(loadAllTableRows(supabase.from("catalogo_categorias").select("*"))),
    unwrap(loadAllTableRows(supabase.from("catalogo_imagens").select("*"))),
    unwrap(loadAllTableRows(supabase.from("catalogo_indicacoes").select("*"), ["material_id"])),
  ]);
  const failed = results.find(r => r.status === "rejected");
  if (failed) throw failed.reason;
  return { products: results[0].value, categories: results[1].value, images: results[2].value, indicacoes: results[3].value };
}
export async function removeCatalogImage(image) {
  await imageAction("remover", image.material_id, image.id);
  await unwrap(bucket().remove([image.caminho, image.miniatura]));
  await imageAction("concluir_exclusao", image.material_id, image.id);
}
async function webp(bitmap, width) {
  const scale = Math.min(1, width / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/webp", 0.82));
  if (!blob || blob.type !== "image/webp" || blob.size > 2097152) throw Error("Não foi possível otimizar esta imagem. Escolha outra imagem.");
  return blob;
}
export async function optimizeCatalogImage(file) {
  if (file.size > 10 * 1024 * 1024) throw Error("Cada imagem original pode ter até 10 MB.");
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  const png = bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71;
  const webpFile = String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  if (!jpeg && !png && !webpFile) throw Error("Use imagens JPEG, PNG ou WebP.");
  let bitmap;
  try {
    bitmap = await window.createImageBitmap(file);
    if (bitmap.width * bitmap.height > 60000000) throw Error("Imagem com resolução muito alta. Reduza para até 60 megapixels.");
    return { principal: await webp(bitmap, 1600), miniatura: await webp(bitmap, 480) };
  } finally { bitmap?.close(); }
}
export async function uploadCatalogImage(product, file, progress, replace = null) {
  progress("Otimizando " + file.name);
  const blobs = await optimizeCatalogImage(file);
  const image = await imageAction("reservar", product, null, { arquivo: file.name, substitui: replace?.id ?? null });
  let confirmed = false;
  try {
    progress("Enviando imagem " + file.name);
    await unwrap(bucket().upload(image.caminho, blobs.principal, { contentType: "image/webp", cacheControl: "31536000" }));
    progress("Enviando miniatura " + file.name);
    await unwrap(bucket().upload(image.miniatura, blobs.miniatura, { contentType: "image/webp", cacheControl: "31536000" }));
    await imageAction("confirmar", product, image.id);
    confirmed = true;
    if (replace) await removeCatalogImage(replace);
  } catch (error) {
    if (!confirmed) {
      try { await removeCatalogImage(image); } catch { throw Error(`${error.message} A limpeza ficou pendente; use “Limpar envio” para tentar novamente.`); }
    }
    throw error;
  }
}
