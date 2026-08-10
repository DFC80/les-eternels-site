export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const VALID_GENDERS = ["HOMME", "FEMME", "AUTRE"];

const SELECT_FIELDS = {
  firstName: true,
  name: true,
  email: true,
  dateOfBirth: true,
  phone: true,
  addressStreet: true,
  addressCity: true,
  addressPostalCode: true,
  gender: true,
  emergencyContactFirstName: true,
  emergencyContactLastName: true,
  emergencyContactPhone: true,
  airsoftHasOwnEquipment: true,
  balance: true,
} as const;

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Vous devez être connecté." }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: SELECT_FIELDS,
  });

  return NextResponse.json(user);
}

export async function PUT(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Vous devez être connecté." }, { status: 401 });
  }

  const body = await request.json();
  const {
    firstName,
    name,
    dateOfBirth,
    phone,
    addressStreet,
    addressCity,
    addressPostalCode,
    gender,
    emergencyContactFirstName,
    emergencyContactLastName,
    emergencyContactPhone,
    airsoftHasOwnEquipment,
  } = body as {
    firstName?: string;
    name?: string;
    dateOfBirth?: string;
    phone?: string;
    addressStreet?: string;
    addressCity?: string;
    addressPostalCode?: string;
    gender?: string;
    emergencyContactFirstName?: string;
    emergencyContactLastName?: string;
    emergencyContactPhone?: string;
    airsoftHasOwnEquipment?: boolean;
  };

  if (!firstName || !name) {
    return NextResponse.json({ error: "Le prénom et le nom sont obligatoires." }, { status: 400 });
  }

  if (gender && !VALID_GENDERS.includes(gender)) {
    return NextResponse.json({ error: "Genre invalide." }, { status: 400 });
  }

  const user = await prisma.user.update({
    where: { id: session.user.id },
    data: {
      firstName,
      name,
      dateOfBirth: dateOfBirth || null,
      phone: phone || null,
      addressStreet: addressStreet || null,
      addressCity: addressCity || null,
      addressPostalCode: addressPostalCode || null,
      gender: gender || null,
      emergencyContactFirstName: emergencyContactFirstName || null,
      emergencyContactLastName: emergencyContactLastName || null,
      emergencyContactPhone: emergencyContactPhone || null,
      airsoftHasOwnEquipment: !!airsoftHasOwnEquipment,
    },
    select: SELECT_FIELDS,
  });

  return NextResponse.json(user);
}

export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Vous devez être connecté." }, { status: 401 });
  }

  const body = await request.json();
  const data: Record<string, unknown> = {};

  if (typeof body.airsoftHasOwnEquipment === "boolean") {
    data.airsoftHasOwnEquipment = body.airsoftHasOwnEquipment;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Aucun champ à mettre à jour." }, { status: 400 });
  }

  const user = await prisma.user.update({
    where: { id: session.user.id },
    data,
    select: SELECT_FIELDS,
  });

  return NextResponse.json(user);
}
