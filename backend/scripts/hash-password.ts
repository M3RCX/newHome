// Gera a entrada de ADMIN_USERS para um admin.
// Uso: npm run hash-password -w backend -- email@exemplo.com
// A senha é pedida no terminal (não fica no histórico do shell).
import bcrypt from "bcryptjs";
import { createInterface } from "node:readline";

const email = process.argv[2]?.trim().toLowerCase();
if (!email || !email.includes("@")) {
  console.error("Uso: npm run hash-password -w backend -- email@exemplo.com");
  process.exit(1);
}

function askHidden(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    // Não ecoa o que é digitado.
    (rl as unknown as { _writeToOutput: (s: string) => void })._writeToOutput = (s) => {
      if (s.includes(question)) process.stdout.write(s);
    };
    rl.question(question, (answer) => {
      rl.close();
      process.stdout.write("\n");
      resolve(answer);
    });
  });
}

const password = await askHidden("Senha: ");
if (password.length < 10) {
  console.error("Use uma senha com pelo menos 10 caracteres.");
  process.exit(1);
}
const confirm = await askHidden("Confirme a senha: ");
if (confirm !== password) {
  console.error("As senhas não conferem.");
  process.exit(1);
}

const hash = await bcrypt.hash(password, 12);
console.log("\nAdicione ao ADMIN_USERS (separe vários admins por vírgula):");
console.log(`${email}:${hash}`);
