"""Strict, versioned Rill fleet contracts independent of any presentation layer."""

from datetime import UTC, datetime
from pathlib import Path, PurePosixPath
from typing import Annotated, Literal, Self
from uuid import uuid4

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    StringConstraints,
    field_validator,
    model_validator,
)

from .constants import FLEET_ASSET_PREFIXES, FLEET_SCHEMA_VERSION

AssetKind = Literal["skill", "agent", "mcp"]
AuditAction = Literal["register", "install", "upgrade", "repair", "retire", "rollback"]
BackupNamespace = Literal["codex", "data"]
Checksum = Annotated[str, StringConstraints(pattern=r"^[a-f0-9]{64}$")]


def utc_now() -> datetime:
    return datetime.now(UTC)


class FleetModel(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)


class AssetFile(FleetModel):
    source: str
    target: str
    sha256: Checksum

    @field_validator("source", "target")
    @classmethod
    def relative_path(cls, value: str) -> str:
        path = PurePosixPath(value)
        if not value or path.is_absolute() or path.as_posix() != value or ".." in path.parts:
            raise ValueError("Asset paths must be normalized repository-relative paths")
        if "\\" in value or value.startswith("."):
            raise ValueError("Asset paths cannot contain escapes or hidden root components")
        return value

    @field_validator("target")
    @classmethod
    def supported_target(cls, value: str) -> str:
        if PurePosixPath(value).parts[0] not in FLEET_ASSET_PREFIXES:
            raise ValueError("Asset target is not a supported Codex-owned path")
        return value


class AgentAssetManifest(FleetModel):
    id: str = Field(min_length=1)
    name: str = Field(min_length=1)
    kind: AssetKind
    version: str = Field(min_length=1)
    files: list[AssetFile] = Field(min_length=1)
    required_env: list[str] = Field(default_factory=list[str])
    mcp_servers: list[str] = Field(default_factory=list[str])

    @field_validator("id", "version")
    @classmethod
    def safe_identity(cls, value: str) -> str:
        if value.startswith((".", "-")) or not all(
            item.isascii() and (item.isalnum() or item in {"-", "_", "."}) for item in value
        ):
            raise ValueError("Manifest identities must be safe directory names")
        return value

    @model_validator(mode="after")
    def distinct_targets(self) -> Self:
        targets = [entry.target for entry in self.files]
        sources = [entry.source for entry in self.files]
        if len(targets) != len(set(targets)) or len(sources) != len(set(sources)):
            raise ValueError("Duplicate asset sources or destinations")
        return self


class RegisteredProject(FleetModel):
    id: str = Field(default_factory=lambda: uuid4().hex)
    name: str = Field(min_length=1)
    path: Path
    registered_at: datetime = Field(default_factory=utc_now)

    @field_validator("path")
    @classmethod
    def require_absolute(cls, path: Path) -> Path:
        if not path.is_absolute():
            raise ValueError("Registered project paths must be absolute")
        return path


class InstalledAsset(FleetModel):
    id: str = Field(min_length=1)
    name: str = Field(min_length=1)
    kind: AssetKind
    version: str
    installed_at: datetime = Field(default_factory=utc_now)
    file_hashes: dict[str, Checksum] = Field(default_factory=dict[str, Checksum])
    source: str
    required_env: list[str] = Field(default_factory=list[str])
    mcp_servers: list[str] = Field(default_factory=list[str])


class AuditRecord(FleetModel):
    id: str = Field(default_factory=lambda: uuid4().hex)
    happened_at: datetime = Field(default_factory=utc_now)
    operation: AuditAction
    subject: str
    backup_id: str | None = None
    details: str = ""


class FleetSnapshot(FleetModel):
    schema_version: int = FLEET_SCHEMA_VERSION
    projects: list[RegisteredProject] = Field(default_factory=list[RegisteredProject])
    assets: list[InstalledAsset] = Field(default_factory=list[InstalledAsset])
    demo: bool = False

    @model_validator(mode="after")
    def unique_references(self) -> Self:
        project_ids = [project.id for project in self.projects]
        asset_ids = [asset.id for asset in self.assets]
        if len(project_ids) != len(set(project_ids)) or len(asset_ids) != len(set(asset_ids)):
            raise ValueError("Duplicate fleet references")
        if self.schema_version != FLEET_SCHEMA_VERSION:
            raise ValueError("Unsupported fleet registry schema")
        return self


class BackupEntry(FleetModel):
    namespace: BackupNamespace
    path: str
    existed: bool
    sha256: Checksum | None = None

    @field_validator("path")
    @classmethod
    def safe_relative(cls, value: str) -> str:
        return AssetFile.relative_path(value)


class BackupSnapshot(FleetModel):
    id: str
    operation: AuditAction
    created_at: datetime = Field(default_factory=utc_now)
    entries: list[BackupEntry]


class GitHubReleaseAsset(FleetModel):
    """Safe native gh release download request, with mandatory archive digest."""

    repository: str
    tag: str
    asset: str
    sha256: Checksum

    @field_validator("repository")
    @classmethod
    def valid_repository(cls, value: str) -> str:
        owner, separator, name = value.partition("/")
        if (
            not separator
            or "/" in name
            or not all(
                part
                and part[0].isalnum()
                and all(char.isascii() and (char.isalnum() or char in "._-") for char in part)
                for part in (owner, name)
            )
        ):
            raise ValueError("Expected safe GitHub owner/repository")
        return value

    @field_validator("tag", "asset")
    @classmethod
    def valid_release_name(cls, value: str) -> str:
        if (
            not value
            or value.startswith("-")
            or not all(char.isascii() and (char.isalnum() or char in "._-") for char in value)
        ):
            raise ValueError("Release tag or asset must be a safe filename")
        return value

    @model_validator(mode="after")
    def archive_type(self) -> Self:
        if not self.asset.endswith(".tar.gz"):
            raise ValueError("GitHub Release asset must be a .tar.gz archive")
        return self
