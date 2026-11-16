import { AppError } from "../../errors/AppError.js";
import type { PublicUser, UserRecord } from "../types.js";
import { hashPassword, verifyPassword } from "./password.js";
import { UserRepository } from "./userRepository.js";

/** Account profile business rules; no HTTP types. */
export class ProfileService {
  constructor(private readonly users: UserRepository) {}

  update(userId: string, displayName: string): PublicUser {
    const user = this.requireUser(userId);
    const name = displayName.trim();
    if (name.length < 1 || name.length > 80) throw AppError.badRequest("Display name must be 1-80 characters");
    this.users.updateDisplayName(user.id, name);
    const updated = this.requireUser(userId);
    return {
      id: updated.id,
      email: updated.email,
      displayName: updated.displayName,
      role: updated.role,
      createdAt: updated.createdAt,
    };
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const user = this.requireUser(userId);
    if (!(await verifyPassword(currentPassword, user.passwordHash))) {
      throw AppError.unauthorized("Current password is incorrect");
    }
    if (newPassword === currentPassword) throw AppError.badRequest("New password must differ from the current one");
    await this.users.updatePassword(user.id, await hashPassword(newPassword));
  }

  private requireUser(id: string): UserRecord {
    const user = this.users.findById(id);
    if (!user) throw AppError.notFound("Account not found");
    return user;
  }
}
