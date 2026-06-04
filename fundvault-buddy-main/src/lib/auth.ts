import { supabase } from "../integrations/supabase/client";

type SignUpInput = {
  phone: string;
  password: string;
  fullName: string;
};

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

function phoneToEmail(phone: string): string {
  return `${normalizePhone(phone)}@fundvault.app`;
}

export async function signUpWithPhone({
  phone,
  password,
  fullName,
}: SignUpInput) {
  const email = phoneToEmail(phone);

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        phone: normalizePhone(phone),
        full_name: fullName,
      },
    },
  });

  if (error) throw error;

  return data;
}

export async function signInWithPhone(phone: string, password: string) {
  const email = phoneToEmail(phone);

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw error;

  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();

  if (error) throw error;
}