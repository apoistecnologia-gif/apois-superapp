import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

function patch(path, transform, label) {
  const full = resolve(path);
  const before = readFileSync(full, 'utf8');
  const after = transform(before);
  if (after === before) {
    console.log(`[OK] ${label} (já aplicado)`);
    return;
  }
  writeFileSync(full, after, 'utf8');
  console.log(`[OK] ${label}`);
}

function replaceRequired(source, search, replacement, label) {
  if (source.includes(replacement)) return source;
  if (!source.includes(search)) throw new Error(`${label}: padrão esperado não encontrado`);
  return source.replace(search, replacement);
}

patch('.work/entregas/src/routes/enderecos/novo.tsx', (source) => {
  source = replaceRequired(
    source,
    '    } catch (error: any) {\n      toast.error(`Erro ao salvar: ${error.message}`);\n    } finally {',
    '    } catch (error) {\n      console.error("customer address create failed", error);\n      toast.error("Não foi possível salvar este endereço. Confira os dados e tente novamente.");\n    } finally {',
    'Novo endereço não expõe erro técnico do backend',
  );
  return source;
}, 'Entregas: criação de endereço usa mensagem segura');

patch('.work/entregas/src/routes/enderecos/editar/$addressId.tsx', (source) => {
  source = replaceRequired(
    source,
    '  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {\n    const { name, value } = e.target;\n    setFormData((prev) => ({\n      ...prev,\n      [name]: value,\n      ...(locationFields.has(name) ? { latitude: null, longitude: null } : {}),\n    }));\n  };',
    '  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {\n    const { name, value } = e.target;\n    setFormData((prev) => {\n      const previousValue = String(prev[name as keyof typeof prev] ?? "").trim();\n      const isCompletingMissingField = locationFields.has(name) && previousValue.length === 0;\n      const mustReconfirmPoint = locationFields.has(name) && !isCompletingMissingField;\n      return {\n        ...prev,\n        [name]: value,\n        ...(mustReconfirmPoint ? { latitude: null, longitude: null } : {}),\n      };\n    });\n  };',
    'Edição preserva coordenadas ao completar campo que o GPS não identificou',
  );
  source = replaceRequired(
    source,
    '    } catch (error: any) {\n      toast.error(`Erro ao salvar: ${error.message}`);\n    } finally {',
    '    } catch (error) {\n      console.error("customer address update failed", error);\n      toast.error("Não foi possível atualizar este endereço. Confira os dados e tente novamente.");\n    } finally {',
    'Editar endereço não expõe erro técnico do backend',
  );
  return source;
}, 'Entregas: edição de endereço preserva GPS e usa mensagem segura');

patch('.work/entregas/src/routes/enderecos.tsx', (source) => {
  return replaceRequired(
    source,
    'className="sticky top-0 z-50 flex items-center justify-center border-b border-zinc-900 bg-black/90 px-4 pb-4 pt-8 backdrop-blur-lg"',
    'className="sticky top-0 z-50 flex items-center justify-center border-b border-zinc-900 bg-black/90 px-4 pb-4 pt-[max(env(safe-area-inset-top),1rem)] backdrop-blur-lg"',
    'Lista de endereços respeita safe area superior',
  );
}, 'Entregas: lista de endereços respeita barra superior do Android');
